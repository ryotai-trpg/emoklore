import { promptResonanceRoll } from "../applications/dialogs/resonance-roll-dialog";
import type { CharacterDataModel, SkillRef } from "../data/character";
import { EmokloreRoll } from "../dice/emoklore-roll";
import { type ResonanceMatch, resolveResonanceRoll } from "../rules/resonance-roll";
import { resolveSkillRoll } from "../rules/skill-roll";
import type { RollSpec } from "../rules/types";
import { createRollMessage, formatSkillName } from "../utils/chat";
import type { EmokloreItem } from "./item";

type ResourceKey = "hp" | "mp" | "resonance";

/** ダメージ適用の結果。チャットに「HP: 15 → 12」と出すために使う */
export type HpChange = { before: number; after: number };

/**
 * system を CharacterDataModel として扱う。
 *
 * `system.json` の documentTypes が character しか宣言しておらず、emoklore.ts も
 * character しか登録していないので、この宣言は実態と一致している。以前は npc を
 * 登録したまま character 固定で宣言しており、判定・リソース操作が `resources?.hp`
 * のように「型が持たないはずの undefined」を防御する形になっていた。
 *
 * NPCを足すときは system が union になるので、型が絞り込みを要求してくる。
 * どこがNPCで壊れるかはそのとき型チェックが教えてくれる（ロードマップ Phase 3）。
 */
export class EmokloreActor extends Actor {
  declare system: CharacterDataModel;

  // スキーマ由来のプロパティは本体JSDocの型に出ないため補強する（docs/v14-migration.md「失われるもの」）
  declare name: string;
  declare flags: Record<string, unknown>;
  // 埋め込みコレクションも同様に型に出ない
  declare items: foundry.utils.Collection<string, EmokloreItem>;
  declare effects: foundry.utils.Collection<string, foundry.documents.ActiveEffect>;

  override getRollData(): Record<string, unknown> {
    const rollData = { ...this.system, flags: this.flags, name: this.name };

    this.system.modifyRollData(rollData);

    return rollData;
  }

  /**
   * ダメージを受ける。
   *
   * `adjustResource` は素の加算で下限を持たないが、こちらは0で止める。ルール上HPは
   * 0で【心肺停止】となり、マイナスのHPという概念がない。
   *
   * `reduction` は軽減量の共通の口。〈耐久〉判定・防御判定はどちらも「受けるダメージを
   * 【成功数】点軽減する」という形で、防具を入れるならそれも同じ引き算になる。
   * いまはどれも配線していないので常に0で呼ばれる。
   */
  async applyDamage(
    amount: number,
    { reduction = 0 }: { reduction?: number } = {},
  ): Promise<HpChange | undefined> {
    const hp = this.system.resources.hp;
    const before = hp.value;
    const applied = Math.max(0, amount - reduction);
    const updates = {
      "system.resources.hp.value": Math.clamp(before - applied, 0, hp.max),
    };

    if (Hooks.call("emoklore.preApplyDamage", this, applied, updates) === false) return;

    await this.update(updates);
    Hooks.callAll("emoklore.applyDamage", this, applied);

    // フックが updates を書き換えている場合があるので、結果は保存後の値から取る
    return { before, after: this.system.resources.hp.value };
  }

  async adjustResource(resource: ResourceKey, point: number): Promise<this | undefined> {
    const newvalue = this.system.resources[resource].value + point;
    return (await this.update({ [`system.resources.${resource}.value`]: newvalue })) as
      | this
      | undefined;
  }

  async rollResonance(
    intensity?: number,
    emotionMatch?: ResonanceMatch,
    options: Record<string, unknown> = {},
  ): Promise<ChatMessage | undefined> {
    if (intensity === undefined) {
      const input = await promptResonanceRoll();
      if (!input) return;

      ({ intensity, emotionMatch } = input);
    }

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
