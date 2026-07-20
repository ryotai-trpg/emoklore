import { type AttackSkillKey, attackSkills } from "../../config/attack-skills";
import type { EmokloreActor } from "../../documents/actor";
import { buildDamageFormula, canRollDamage } from "../../rules/weapon-damage";
import { renderWeaponCard, type WeaponCardState } from "../../utils/weapon";
import { EmokloreSystemDataModel } from "../system-model";

const { DocumentUUIDField, NumberField, StringField } = foundry.data.fields;

/** カードの1ボタンぶんの処理。押した瞬間に this がモデルに束縛される */
type CardAction = (this: WeaponCardModel) => Promise<void>;

/**
 * カードが載っている ChatMessage。
 *
 * `parent` は本体の型では DataModel 止まりで、ChatMessage のメンバーが出てこない。
 * 実際に使うものだけを交差型で補う（docs/v14-migration.md「失われるもの」）。
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

export type WeaponCardSchema = ReturnType<typeof defineWeaponCardSchema>;

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
export class WeaponCardModel extends EmokloreSystemDataModel<WeaponCardSchema> {
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

  get damageRoll(): foundry.dice.Roll | undefined {
    return this.message.rolls[1];
  }

  /** ダメージを振れるか。攻撃判定が済んでいて、かつ命中していること */
  get canRollDamage(): boolean {
    return this.successCount !== null && canRollDamage(this.successCount);
  }

  /**
   * 攻撃判定を振り、同じカードに書き足す。
   *
   * 攻撃判定は技能判定そのものなので、アクター側の組み立てをそのまま借りる。
   */
  async rollAttack(): Promise<void> {
    if (this.successCount !== null) return;

    const actor = await this.#resolveActor();
    if (!actor) {
      ui.notifications?.warn("EMOKLORE.ChatMessage.weapon.ActorMissing", { localize: true });
      return;
    }

    const config = { skill: this.skill, base: attackSkills[this.skill]?.base ?? false };
    if (Hooks.call("emoklore.preRollAttack", this.message, config) === false) return;

    const { roll } = await actor.buildSkillRoll(config.skill, { base: config.base });
    await this.#applyRoll([roll], { successCount: roll.successCount });

    Hooks.callAll("emoklore.rollAttack", this.message, roll);
  }

  /** ダメージを振り、同じカードに書き足す */
  async rollDamage(): Promise<void> {
    if (!this.canRollDamage || this.damageTotal !== null) return;

    const config = {
      // canRollDamage が成功数の非nullを保証している
      successCount: this.successCount as number,
      damageDie: attackSkills[this.skill]?.damageDie ?? null,
      attackPower: this.attackPower,
      // 〈ストレングス〉加算の接続点。近接なら技能レベルを渡す想定だが、いまは常に0
      bonus: 0,
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
};
