import { promptResonanceRoll } from "../applications/dialogs/resonance-roll-dialog";
import type { CharacterDataModel } from "../data/character";
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
 * 判定・リソース操作はいずれもcharacterのスキーマ前提で書かれており、NPCに対して
 * 呼ぶと実行時に壊れる。型引数で character / npc を出し分ける形も試したが、
 * クラス本体では条件型が解決されず union のままになるため実益がなかった。
 * NPC用シートの実装（ロードマップ Phase 3）で判定まわりの扱いごと見直す。
 */
export class EmokloreActor extends Actor {
  declare system: CharacterDataModel;

  // スキーマ由来のプロパティは本体JSDocの型に出ないため補強する（docs/v14-migration.md「失われるもの」）
  declare name: string;
  declare flags: Record<string, unknown>;
  // 埋め込みコレクションも同様に型に出ない
  declare items: foundry.utils.Collection<string, EmokloreItem>;
  declare effects: foundry.utils.Collection<string, foundry.documents.ActiveEffect>;
  // sheet は ClientDocumentMixin 由来でジェネリクスが消えている
  declare sheet: { render: (force?: boolean) => void } | null;
  declare isOwner: boolean;

  override getRollData(): Record<string, unknown> {
    const rollData = { ...this.system, flags: this.flags, name: this.name };

    if (this.system.modifyRollData instanceof Function) {
      this.system.modifyRollData(rollData);
    }

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
    // NPCなどHPを持たないスキーマに対して呼ばれても壊れないようにする
    const hp = this.system.resources?.hp;
    if (!hp) return;

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
    const newvalue = (this.system.resources[resource]?.value ?? 0) + point;
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
    skill: string,
    options: { base?: boolean } & Record<string, unknown> = {},
  ): Promise<ChatMessage | undefined> {
    const { roll, flavor } = await this.buildSkillRoll(skill, options);

    return createRollMessage({ actor: this, flavor, roll });
  }

  /**
   * 技能判定のRollを組み立てて評価する。チャットには流さない。
   *
   * 武器カードのように、判定結果を自分のメッセージに抱えたい側が使う。
   * 攻撃判定は技能判定そのものなので、専用のロジックを別に持つ必要がない。
   */
  async buildSkillRoll(
    skill: string,
    { base = false, ...options }: { base?: boolean } & Record<string, unknown> = {},
  ): Promise<{ roll: EmokloreRoll; flavor: string }> {
    const context = this.system.getSkillRollContext(skill, { base });
    const spec = resolveSkillRoll(context.params);

    return {
      roll: await this.#buildRoll(spec, options),
      flavor: EmokloreActor.formatRollFlavor(formatSkillName(context, { base })),
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
