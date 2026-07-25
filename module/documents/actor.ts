import type { CharacterDataModel, SkillRef } from "../data/character";
import { EmokloreRoll } from "../dice/emoklore-roll";
import { type ResonanceMatch, resolveResonanceRoll } from "../rules/resonance-roll";
import { resolveMpBoundary } from "../rules/resource-boundary";
import { resolveSkillRoll } from "../rules/skill-roll";
import type { RollSpec } from "../rules/types";
import { calculateAppliedDamage } from "../rules/weapon-damage";
import { createMpNoticeMessage, createRollMessage, formatSkillName } from "../utils/chat";
import type { EmokloreItem } from "./item";

type ResourceKey = "hp" | "mp" | "resonance";

/** ダメージ適用の結果。チャットに「HP: 15 → 12」と出すために使う */
export type HpChange = {
  before: number;
  after: number;
  /** 軽減に使った防具の値。結果行の内訳に出す */
  armor: number;
};

/**
 * system を CharacterDataModel として扱う。
 *
 * `system.json` の documentTypes が character しか宣言しておらず、emoklore.ts も
 * character しか登録していないので、この宣言は実態と一致している。作成できない種別を
 * 登録したまま固定で宣言すると型が嘘になり、判定・リソース操作に `resources?.hp` の
 * ような「型が持たないはずの undefined」への防御が要るようになる。
 *
 * NPCを足すときは system が union になるので、型が絞り込みを要求してくる。
 * どこがNPCで壊れるかはそのとき型チェックが教えてくれる（ロードマップ Phase 3）。
 */
export class EmokloreActor extends Actor {
  declare system: CharacterDataModel;

  // スキーマ由来のプロパティは本体JSDocの型に出ないため補強する（docs/code-design.md「本体の型が足りないとき」）
  declare name: string;
  declare flags: Record<string, unknown>;
  // 埋め込みコレクションも同様に型に出ない
  declare items: foundry.utils.Collection<string, EmokloreItem>;
  declare effects: foundry.utils.Collection<string, foundry.documents.ActiveEffect>;

  /**
   * `@` で参照できる値。判定式のほか、ActiveEffectの効果値の解決にも使われる
   * （本体の `applyActiveEffects` が `replacementData` としてこれを渡す）。
   *
   * `system` を展開するだけでスキーマのフィールドは一通り入る。`initiative` も
   * 実フィールドなので、個別に足す中継は要らない。
   *
   * 展開は浅いので、入れ子は参照のまま。効果の適用途中でも現在値が読める
   */
  override getRollData(): Record<string, unknown> {
    return { ...this.system, flags: this.flags, name: this.name };
  }

  /**
   * ダメージを受ける。
   *
   * `adjustResource` は素の加算で下限を持たないが、こちらは0で止める。ルール上HPは
   * 0で【心肺停止】となり、マイナスのHPという概念がない。
   *
   * `reduction` は軽減量の共通の口。〈耐久〉判定・防御判定はどちらも「受けるダメージを
   * 【成功数】点軽減する」という形で、武器カードの「軽減して適用」がここへ渡してくる。
   * 防具は同じ引き算のもう1つの項。未指定なら装備中防具の合計（`system.armor`）が
   * 自動で乗り、ダイアログで部位条件により外したときだけ上書き値が渡ってくる。
   */
  async applyDamage(
    amount: number,
    { reduction = 0, armor }: { reduction?: number; armor?: number | undefined } = {},
  ): Promise<HpChange | undefined> {
    // 防具の既定は「装備中防具の合計」。この1行だけが既定を決める
    // （「自動で乗せるか」をシステム設定にするときはここに差す）
    const armorApplied = armor ?? this.system.armor;

    const hp = this.system.resources.hp;
    const before = hp.value;
    const applied = calculateAppliedDamage({ amount, reduction, armor: armorApplied });
    const updates = {
      "system.resources.hp.value": Math.clamp(before - applied, 0, hp.max),
    };

    if (Hooks.call("emoklore.preApplyDamage", this, applied, updates) === false) return;

    await this.update(updates);
    Hooks.callAll("emoklore.applyDamage", this, applied);

    // フックが updates を書き換えている場合があるので、結果は保存後の値から取る
    return { before, after: this.system.resources.hp.value, armor: armorApplied };
  }

  async adjustResource(resource: ResourceKey, point: number): Promise<this | undefined> {
    const newvalue = this.system.resources[resource].value + point;
    return (await this.update({ [`system.resources.${resource}.value`]: newvalue })) as
      | this
      | undefined;
  }

  /**
   * MP境界の検知のために、更新前の値を options に捕まえる。
   *
   * MPにはダメージ適用（HP側）のような一元の減少口が無く、シートの直接編集が
   * 減少手段なので、Document の更新そのものを見るしかない。`_onUpdate` の時点では
   * 旧値がもう手に入らないため、ここで運ぶ。
   */
  override async _preUpdate(
    ...args: Parameters<Actor["_preUpdate"]>
  ): Promise<boolean | undefined> {
    const [changed, options] = args;
    const allowed = await super._preUpdate(...args);
    if (allowed === false) return false;

    if (foundry.utils.hasProperty(changed, "system.resources.mp.value")) {
      foundry.utils.setProperty(options, "emoklore.mpBefore", this.system.resources.mp.value);
    }

    return undefined;
  }

  override _onUpdate(...args: Parameters<Actor["_onUpdate"]>): void {
    super._onUpdate(...args);
    const [, options, userId] = args;

    // 更新は全クライアントで発火する。案内を出すのは更新した本人だけ
    // （draw-steel の updateStaminaEffects と同じガード）
    if (game.userId !== userId) return;

    const before = foundry.utils.getProperty(options, "emoklore.mpBefore");
    if (typeof before !== "number") return;

    const after = this.system.resources.mp.value;
    if (!resolveMpBoundary({ before, after })) return;

    void createMpNoticeMessage(this, { before, after });
  }

  /**
   * 共鳴判定。強度と一致度は検証済みの値を必須で受ける。
   *
   * ダイアログで尋ねる入口は `applications/rolls.ts` の `requestResonanceRoll`。
   * 「引数が無ければ開く」という判断をここに置くと `applications/` への逆依存になる
   */
  async rollResonance(
    intensity: number,
    emotionMatch: ResonanceMatch,
    options: Record<string, unknown> = {},
  ): Promise<ChatMessage | undefined> {
    const spec = resolveResonanceRoll({
      resonanceValue: this.system.resources.resonance.value,
      intensity,
      emotionMatch,
    });

    return this.#postRoll(spec, game.i18n.localize("EMOKLORE.Resonance.Name"), options);
  }

  async rollSkill(
    ref: SkillRef,
    options: Record<string, unknown> = {},
  ): Promise<ChatMessage | undefined> {
    const { roll, flavor } = await this.buildSkillRoll(ref, options);

    return createRollMessage({ actor: this, flavor, roll });
  }

  /**
   * 技能判定のRollを組み立てて評価する。チャットには流さない。
   *
   * 武器カードのように、判定結果を自分のメッセージに抱えたい側が使う。
   * 攻撃判定は技能判定そのものなので、専用のロジックを別に持つ必要がない。
   */
  async buildSkillRoll(
    ref: SkillRef,
    options: Record<string, unknown> = {},
  ): Promise<{ roll: EmokloreRoll; flavor: string }> {
    const context = this.system.getSkillRollContext(ref);
    const spec = resolveSkillRoll(context.params);

    return {
      roll: await this.#buildRoll(spec, options),
      flavor: EmokloreActor.formatRollFlavor(formatSkillName(context)),
    };
  }

  /** チャットの見出し。判定の種類によらず「〈○○〉判定」の形にする */
  static formatRollFlavor(skillName: string): string {
    return game.i18n.localize("EMOKLORE.skillRoll", { skillName });
  }

  /** 判定内容からRollを作って評価する */
  async #buildRoll(spec: RollSpec, options: Record<string, unknown>): Promise<EmokloreRoll> {
    // 本体の evaluate() の戻り型は Roll なので、戻り値ではなくインスタンスを取り回す
    const roll = EmokloreRoll.fromSpec(spec, options);
    await roll.evaluate();

    return roll;
  }

  /** 判定内容からRollを作り、チャットに流す。判定の種類によらず共通 */
  async #postRoll(
    spec: RollSpec,
    skillName: string,
    options: Record<string, unknown>,
  ): Promise<ChatMessage | undefined> {
    return createRollMessage({
      actor: this,
      flavor: EmokloreActor.formatRollFlavor(skillName),
      roll: await this.#buildRoll(spec, options),
    });
  }
}
