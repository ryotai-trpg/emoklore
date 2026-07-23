import type { AttackSkillKey } from "../../config/attack-skills";
import type { EmokloreActor } from "../../documents/actor";
import { applyDamageToTargets } from "../../documents/queries";
import { buildDamageFormula, resolveStrengthBonus } from "../../rules/weapon-damage";
import { createDamageAppliedMessage } from "../../utils/chat";
import { resolveTargetActors } from "../../utils/targets";
import {
  type CardButtons,
  renderWeaponCard,
  resolveAttackSkill,
  resolveCardButtons,
  type WeaponCardState,
} from "../../utils/weapon";
import { resolveSkillRef } from "../character";
import { EmokloreSystemDataModel } from "../system-model";

const { DocumentUUIDField, NumberField, StringField } = foundry.data.fields;

/** カードの1ボタンぶんの処理。押した瞬間に this がモデルに束縛される */
type CardAction = (this: WeaponCardModel) => Promise<void>;

/**
 * カードが載っている ChatMessage。
 *
 * `parent` は本体の型では DataModel 止まりで、ChatMessage のメンバーが出てこない。
 * 実際に使うものだけを交差型で補う（docs/code-design.md「本体の型が足りないとき」）。
 */
type CardMessage = ChatMessage & {
  rolls: foundry.dice.Roll[];
  update: (data: Record<string, unknown>) => Promise<unknown>;
};

const defineWeaponCardSchema = () => {
  return {
    // 表示と再ロールに要る値は使用時点で焼き込む。武器やアクターを消したあとでも
    // 過去のカードが読めて、ダメージも振り直せるようにするため
    weaponName: new StringField({ required: true, blank: true, initial: "" }),
    weaponImg: new StringField({ required: true, blank: true, initial: "" }),
    skill: new StringField({ required: true, blank: false, initial: "fight" }),
    attackPower: new StringField({ required: true, blank: true, initial: "" }),
    rangeLabel: new StringField({ required: true, blank: true, initial: "" }),

    // 参照はモジュール連携のために持つ。カードの描画自体は上の焼き込みだけで足りる
    itemUuid: new DocumentUUIDField({ type: "Item", nullable: true, initial: null }),
    actorUuid: new DocumentUUIDField({ type: "Actor", nullable: true, initial: null }),

    // まだ振っていなければ null。ボタンの出し分けはこの2つで決まる
    successCount: new NumberField({ required: true, integer: true, nullable: true, initial: null }),
    damageTotal: new NumberField({ required: true, integer: true, nullable: true, initial: null }),
  };
};

/**
 * 武器カードのChatMessage。
 *
 * 1枚のカードが育つ形にしている。攻撃判定もダメージも同じメッセージに追記していくので、
 * 状態（成功数・ダメージ）をメッセージ自身が持てるサブタイプが素直に噛み合う。
 *
 * `renderHTML` は定義しない。定義すると本体のメッセージ枠（アバター・発言者・時刻・削除）を
 * まるごと自前で描くことになる。`content` だけを自分で持ち、枠は本体に描かせる。
 * 本体は `content` に要素があれば `rolls` を自動描画しないので、ロールをメッセージに
 * 載せたまま、カード側で見出し付きに並べられる。
 */
export class WeaponCardModel extends EmokloreSystemDataModel {
  declare weaponName: string;
  declare weaponImg: string;
  declare skill: AttackSkillKey;
  declare attackPower: string;
  declare rangeLabel: string;
  declare itemUuid: string | null;
  declare actorUuid: string | null;
  declare successCount: number | null;
  declare damageTotal: number | null;

  /** カードのボタン。`data-action` の値と対応する。モジュールはここに足せる */
  static ACTIONS: Record<string, CardAction>;

  static override defineSchema() {
    return defineWeaponCardSchema();
  }

  static override LOCALIZATION_PREFIXES = ["EMOKLORE.ChatMessage.weapon"];

  /** カードが載っているメッセージ。parent の型が DataModel 止まりなのでここで1回だけ絞る */
  get message(): CardMessage {
    return this.parent as CardMessage;
  }

  get attackRoll(): foundry.dice.Roll | undefined {
    return this.message.rolls[0];
  }

  /** ボタンの出し分け。描画側と同じ判定を使う */
  get buttons(): CardButtons {
    return resolveCardButtons(this);
  }

  /**
   * 攻撃判定を振り、同じカードに書き足す。
   *
   * 攻撃判定は技能判定そのものなので、アクター側の組み立てをそのまま借りる。
   */
  async rollAttack(): Promise<void> {
    if (!this.buttons.canRollAttack) return;

    const actor = await this.#resolveActor();
    if (!actor) {
      ui.notifications?.warn("EMOKLORE.ChatMessage.weapon.ActorMissing", { localize: true });
      return;
    }

    // base は skill から決まるので config に載せない。両方を載せると、skill だけを
    // 差し替えるフックが「通常技能のキーに base: true」のような対を作れてしまう
    const config = { skill: this.skill };
    if (Hooks.call("emoklore.preRollAttack", this.message, config) === false) return;

    // skill はカードに焼き込んだ保存データで、フックで差し替えられてもいる。
    // 宣言した型（AttackSkillKey）を裏切りうるので、判定に渡す前に確かめる。
    // base を引くのはフックの後。先に引くと差し替え前の技能の答えを使うことになる
    const ref = resolveSkillRef(config.skill, { base: resolveAttackSkill(config.skill).base });
    if (!ref) {
      ui.notifications?.warn("EMOKLORE.ChatMessage.weapon.UnknownSkill", { localize: true });
      return;
    }

    const { roll } = await actor.buildSkillRoll(ref);
    await this.#applyRoll([roll], { successCount: roll.successCount });

    Hooks.callAll("emoklore.rollAttack", this.message, roll);
  }

  /** ダメージを振り、同じカードに書き足す */
  async rollDamage(): Promise<void> {
    if (!this.buttons.canRollDamage) return;

    // アクターが消えたカードでもダメージは振り直せる。そのときは〈ストレングス〉加算なし
    const actor = await this.#resolveActor();
    const { damageDie, rangeType } = resolveAttackSkill(this.skill);
    const config = {
      // canRollDamage が成功数の非nullを保証している
      successCount: this.successCount as number,
      damageDie,
      attackPower: this.attackPower,
      bonus: resolveStrengthBonus(rangeType, actor?.system.skills.strength.level ?? 0),
    };
    if (Hooks.call("emoklore.preRollDamage", this.message, config) === false) return;

    const roll = new foundry.dice.Roll(buildDamageFormula(config));
    await roll.evaluate();

    const attackRoll = this.attackRoll;
    const rolls = attackRoll ? [attackRoll, roll] : [roll];
    await this.#applyRoll(rolls, { damageTotal: roll.total ?? 0 });

    Hooks.callAll("emoklore.rollDamage", this.message, roll);
  }

  /**
   * 振ったダメージを対象に適用する。
   *
   * 対象は押した瞬間のターゲットだけ。敵のように自分がOWNER権限を持たないアクターは
   * クライアントから直接書き換えられない（サーバが `Document#update` を権限検査する）ので、
   * 1体でも触れないものが混じっていればGMのクライアントにまとめて肩代わりしてもらう。
   */
  async applyDamage(): Promise<void> {
    const targets = resolveTargetActors();
    if (targets.length === 0) {
      ui.notifications?.warn("EMOKLORE.ChatMessage.weapon.NoTarget", { localize: true });
      return;
    }

    await this.applyDamageTo(targets);
  }

  /**
   * 振ったダメージを対象へ適用し、結果をチャットに流す。
   *
   * 対象の集め方はボタンごとに違う（即適用はターゲット、軽減つきはダイアログを挟む）ので、
   * その先の共通の後段だけを持つ。
   */
  async applyDamageTo(targets: EmokloreActor[]): Promise<void> {
    // canApplyDamage と同じ条件だが、ダメージ量の型を絞るためここでは直接見る
    const amount = this.damageTotal;
    if (amount === null) return;

    // 権限の有無とGMへの委譲は documents/queries.ts が引き受ける
    const applied = await applyDamageToTargets(targets, amount);
    if (!applied) {
      ui.notifications?.warn("EMOKLORE.ChatMessage.weapon.NoGM", { localize: true });
      return;
    }

    if (applied.length > 0) await createDamageAppliedMessage(applied);
  }

  /**
   * ロールと状態をカードに書き戻す。
   *
   * `content` を毎回組み直すのは、ボタンの出し分けと結果の表示が状態と一緒に変わるため。
   * 作成時と違って更新では `sound` が鳴らないので、ダイス音はここで明示的に鳴らす。
   */
  async #applyRoll(rolls: foundry.dice.Roll[], changes: Partial<WeaponCardState>): Promise<void> {
    const system = { ...this.toObject(), ...changes } as WeaponCardState;
    const content = await renderWeaponCard(system, rolls);

    await this.message.update({ content, rolls, system });

    // モジュールが CONFIG.sounds を空にしている場合があるので、あるときだけ鳴らす
    const sound = CONFIG.sounds.dice;
    if (sound) foundry.audio.AudioHelper.play({ src: sound }, true);
  }

  async #resolveActor(): Promise<EmokloreActor | undefined> {
    if (!this.actorUuid) return undefined;

    return ((await foundry.utils.fromUuid(this.actorUuid)) as EmokloreActor | null) ?? undefined;
  }

  /**
   * カードのボタンに反応する。`renderChatMessageHTML` から呼ばれる。
   *
   * リスナはカードのルートに1つだけ張り、`data-action` で振り分ける。本体のチャットログは
   * 自前のアクション表しか見ないので、システム側のボタンはここで拾う必要がある。
   */
  addListeners(html: HTMLElement): void {
    const card = html.querySelector(".em-weapon-card");
    if (!card) return;

    card.addEventListener("click", (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>("[data-action]");
      const actionName = target?.dataset.action;
      if (!target || !actionName) return;

      const action = WeaponCardModel.ACTIONS[actionName];
      if (!action) return;

      // 連打で二重に振らせない。処理中はボタンを落とし、成否によらず必ず戻す
      const button = target instanceof HTMLButtonElement ? target : null;
      if (button) button.disabled = true;

      action
        .call(this)
        .catch((error: unknown) => {
          console.error("emoklore | 武器カードの操作に失敗しました", error);
          ui.notifications?.error("EMOKLORE.ChatMessage.weapon.ActionFailed", { localize: true });
        })
        .finally(() => {
          if (button) button.disabled = false;
        });
    });
  }
}

// クラス本体の静的初期化子から prototype を引くと定義順に依存するので、外で組み立てる
WeaponCardModel.ACTIONS = {
  rollAttack: WeaponCardModel.prototype.rollAttack,
  rollDamage: WeaponCardModel.prototype.rollDamage,
  applyDamage: WeaponCardModel.prototype.applyDamage,
};
