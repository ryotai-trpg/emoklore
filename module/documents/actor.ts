import type { CharacterDataModel, SkillRef } from "../data/character";
import type { CharacterLikeDataModel } from "../data/character-like";
import type { KaiDataModel } from "../data/kai";
import type { NpcDataModel } from "../data/npc";
import { EmokloreRoll } from "../dice/emoklore-roll";
import { buildKaiAttackSpec, substituteSuccess } from "../rules/kai-attack";
import { type ResonanceMatch, resolveResonanceRoll } from "../rules/resonance-roll";
import { resolveMpBoundary } from "../rules/resource-boundary";
import { resolveSkillRoll } from "../rules/skill-roll";
import { type ModifierSet, NO_MODIFIER, type RollSpec, sumModifiers } from "../rules/types";
import { calculateAppliedDamage } from "../rules/weapon-damage";
import { createMpNoticeMessage, createRollMessage, formatSkillName } from "../utils/chat";
import { type KaiAttackCardState, renderKaiAttackCard } from "../utils/kai";
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
 * system は種別ごとのデータモデルのunion。
 *
 * character（共鳴者）・npc（人間NPC）・kai（怪異）の3種別を登録しているので、
 * `system` はそれらのunionになる。共通して持つのは `resources.hp/mp` で、これらに触る
 * リソース操作（applyDamage・MP境界）は絞り込みなしで通る。共鳴値・技能判定のように
 * 一部の種別しか持たないものは、型述語（isCharacter / isCharacterLike / isKai）で絞ってから触る。
 *
 * 作成できない種別を登録すると型が嘘になるので、`system.json` の documentTypes と
 * emoklore.ts の登録は必ず揃える。
 */
export class EmokloreActor extends Actor {
  declare system: CharacterDataModel | NpcDataModel | KaiDataModel;

  // スキーマ由来のプロパティは本体JSDocの型に出ないため補強する（docs/code-design.md「本体の型が足りないとき」）
  declare name: string;
  declare type: "character" | "npc" | "kai";
  declare flags: Record<string, unknown>;
  // 埋め込みコレクションも同様に型に出ない
  declare items: foundry.utils.Collection<string, EmokloreItem>;
  declare effects: foundry.utils.Collection<string, foundry.documents.ActiveEffect>;

  /**
   * 種別の判定と `system` の絞り込みを1つにまとめる（`EmokloreItem#isWeapon` と同じ形）。
   * 確認したうえで、さらに `as` で名乗り直すことにならないようにする。
   */
  isCharacter(): this is EmokloreActor & { system: CharacterDataModel } {
    return this.type === "character";
  }

  isNpc(): this is EmokloreActor & { system: NpcDataModel } {
    return this.type === "npc";
  }

  isKai(): this is EmokloreActor & { system: KaiDataModel } {
    return this.type === "kai";
  }

  /** 共鳴者・人間NPCの共通基底。真なら能力値・技能・技能判定（getSkillRollContext）を読める */
  isCharacterLike(): this is EmokloreActor & { system: CharacterLikeDataModel } {
    return this.type === "character" || this.type === "npc";
  }

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
   * 防具は同じ引き算のもう1つの項。未指定なら共鳴者・人間NPCは装備中防具の合計
   * （`system.armor`）が自動で乗り、ダイアログで部位条件により外したときだけ上書き値が
   * 渡ってくる。
   *
   * 怪異の装甲は本人が常に持つ平坦な軽減なので、`reduction` / `armor` を渡す側に
   * 足させず、ここで自前で上乗せする（防具アイテムの概念を持たないため独立に扱う）。
   */
  async applyDamage(
    amount: number,
    { reduction = 0, armor }: { reduction?: number; armor?: number | undefined } = {},
  ): Promise<HpChange | undefined> {
    // 防具の既定は「装備中防具の合計」（共鳴者・人間NPCだけ）。この1行だけが既定を決める
    // （「自動で乗せるか」をシステム設定にするときはここに差す）
    const armorApplied = armor ?? (this.isCharacterLike() ? this.system.armor : 0);
    const kaiArmor = this.isKai() ? this.system.resources.armor : 0;

    const hp = this.system.resources.hp;
    const before = hp.value;
    const applied = calculateAppliedDamage({
      amount,
      reduction,
      armor: armorApplied + kaiArmor,
    });
    const updates = {
      "system.resources.hp.value": Math.clamp(before - applied, 0, hp.max),
    };

    if (Hooks.call("emoklore.preApplyDamage", this, applied, updates) === false) return;

    await this.update(updates);
    Hooks.callAll("emoklore.applyDamage", this, applied);

    // フックが updates を書き換えている場合があるので、結果は保存後の値から取る
    return { before, after: this.system.resources.hp.value, armor: armorApplied + kaiArmor };
  }

  /**
   * 〈∞共鳴〉を上げる。共鳴判定に成功したときと、憑依判定を振ったとき。
   *
   * 上限で止めない。ルールブックはレベル10で【逸脱】としており、上限を超えたことが
   * 見えるほうがDLの判断材料になる（`resources.resonance.max` はバーの目盛りで、
   * ルール上の天井ではない）。
   *
   * @returns 変化の前後。共鳴者でなければ undefined
   */
  async raiseResonance(amount: number): Promise<{ before: number; after: number } | undefined> {
    if (!this.isCharacter()) return undefined;

    const before = this.system.resources.resonance.value;
    if (amount <= 0) return { before, after: before };

    await this.update({ "system.resources.resonance.value": before + amount });

    return { before, after: this.system.resources.resonance.value };
  }

  async adjustResource(resource: ResourceKey, point: number): Promise<this | undefined> {
    // resonance は共鳴者だけが持つ。ここを抜けると resource は "hp" | "mp"（全種別が同形で持つ）
    if (resource === "resonance") {
      if (!this.isCharacter()) return undefined;
      const value = this.system.resources.resonance.value + point;
      return (await this.update({ "system.resources.resonance.value": value })) as this | undefined;
    }

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
    situational: ModifierSet = NO_MODIFIER,
  ): Promise<ChatMessage | undefined> {
    // 共鳴判定は共鳴者だけが持つ（〈∞共鳴〉値がダイス数になる）。入口は共鳴者シートに
    // しかないので、ここへ他種別で来るのは呼び出し側の誤り。黙って変な判定を振らせない
    if (!this.isCharacter()) {
      ui.notifications?.warn("EMOKLORE.Resonance.NotCharacter", { localize: true });
      return;
    }

    const spec = resolveResonanceRoll({
      resonanceValue: this.system.resources.resonance.value,
      intensity,
      emotionMatch,
      // 〈∞共鳴〉に乗った効果と、その場の修正を合わせる
      mod: sumModifiers(this.system.resources.resonance.mod, situational),
    });

    return this.#postRoll(spec, game.i18n.localize("EMOKLORE.Resonance.Name"), options);
  }

  /**
   * 怪異の攻撃を振り、結果を攻撃カードに出す。
   *
   * 攻撃判定は能力値から派生させず、攻撃が持つダイス数と判定値で直接振る。judgeless の攻撃は
   * 判定を振らず固定成功数を使う。ダメージは自由式で、成功数（@success）を差し替えて評価する。
   * カードの「ダメージ適用」ボタンのハンドラは applications/ 側が持つ（data/ に駆動を置かない）。
   */
  async rollKaiAttack(
    index: number,
    options: Record<string, unknown> = {},
  ): Promise<ChatMessage | undefined> {
    if (!this.isKai()) {
      throw new Error(`emoklore | 怪異ではないので攻撃を持ちません: ${this.type}`);
    }

    const attack = this.system.attacks[index];
    if (!attack) return;

    // 判定。judgeless なら振らずに固定成功数を使う
    let judgmentRoll: EmokloreRoll | null = null;
    let successCount: number;
    if (attack.judgeless) {
      successCount = attack.fixedSuccess;
    } else {
      const spec = buildKaiAttackSpec({ diceCount: attack.diceCount, target: attack.target });
      judgmentRoll = EmokloreRoll.fromSpec(spec, options);
      await judgmentRoll.evaluate();
      successCount = judgmentRoll.successCount;
    }

    // ダメージ。式が空なら振らない。成功数は @success を差し替えて渡す
    let damageRoll: foundry.dice.Roll | null = null;
    let damageTotal: number | null = null;
    if (attack.damage) {
      damageRoll = new foundry.dice.Roll(substituteSuccess(attack.damage, successCount));
      await damageRoll.evaluate();
      damageTotal = damageRoll.total ?? 0;
    }

    const state: KaiAttackCardState = {
      attackName: attack.name || game.i18n.localize("EMOKLORE.ChatMessage.kaiAttack.UnnamedAttack"),
      actorUuid: this.uuid ?? null,
      mpCost: attack.mpCost,
      judgeless: attack.judgeless,
      successCount,
      damageTotal,
    };

    const rolls = [judgmentRoll, damageRoll].filter(
      (roll): roll is foundry.dice.Roll => roll !== null,
    );
    const created = await ChatMessage.create({
      type: "kaiAttack",
      system: state,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      rolls,
      content: await renderKaiAttackCard(state, { judgmentRoll, damageRoll }),
      sound: CONFIG.sounds.dice,
      flags: { core: { canPopout: true } },
    });

    return created as ChatMessage | undefined;
  }

  async rollSkill(
    ref: SkillRef,
    options: Record<string, unknown> = {},
    situational: ModifierSet = NO_MODIFIER,
  ): Promise<ChatMessage | undefined> {
    const { roll, flavor } = await this.buildSkillRoll(ref, options, situational);

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
    situational: ModifierSet = NO_MODIFIER,
  ): Promise<{ roll: EmokloreRoll; flavor: string }> {
    // 技能判定は能力値＋技能を持つ共鳴者・人間NPCだけ。怪異は直接判定の攻撃を使う
    if (!this.isCharacterLike()) {
      throw new Error(`emoklore | この種別は技能判定を持ちません: ${this.type}`);
    }

    // data/ が集めるのは保存データだけ。その場の修正はここで差し込む
    const context = this.system.getSkillRollContext(ref);
    const spec = resolveSkillRoll({ ...context.params, situationalMod: situational });

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
