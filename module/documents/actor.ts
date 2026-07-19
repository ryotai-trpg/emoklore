import { promptResonanceRoll } from "../applications/dialogs/resonance-roll-dialog";
import type { CharacterDataModel, SkillRollContext } from "../data/character";
import { EmokloreRoll } from "../dice/emoklore-roll";
import { type ResonanceMatch, resolveResonanceRoll } from "../rules/resonance-roll";
import { resolveSkillRoll } from "../rules/skill-roll";
import type { RollSpec } from "../rules/types";
import { createRollMessage } from "../utils/chat";

type ResourceKey = "hp" | "mp" | "resonance";
type EmokloreActorType = "character" | "npc";

export class EmokloreActor<SubType extends EmokloreActorType = EmokloreActorType> extends Actor {
  declare system: SubType extends "character"
    ? CharacterDataModel
    : SubType extends "npc"
      ? any // NPCの型定義が必要
      : any;

  // スキーマ由来のプロパティは本体JSDocの型に出ないため補強する（docs/v14-migration.md「失われるもの」）
  declare name: string;
  declare flags: Record<string, unknown>;

  override getRollData(): Record<string, unknown> {
    const rollData = { ...this.system, flags: this.flags, name: this.name };

    if (this.system.modifyRollData instanceof Function) {
      this.system.modifyRollData(rollData);
    }

    return rollData;
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
    { base = false, ...options }: { base?: boolean } & Record<string, unknown> = {},
  ): Promise<ChatMessage | undefined> {
    const context = this.system.getSkillRollContext(skill, { base });
    const spec = resolveSkillRoll(context.params);

    return this.#postRoll(spec, formatSkillName(context, { base }), options);
  }

  /** 判定内容からRollを作り、チャットに流す。判定の種類によらず共通 */
  async #postRoll(
    spec: RollSpec,
    skillName: string,
    options: Record<string, unknown>,
  ): Promise<ChatMessage | undefined> {
    const roll = await new EmokloreRoll(
      `${spec.diceCount}d10`,
      {},
      {
        ...options,
        target: spec.target,
        successMod: spec.successMod,
        dmFormula: spec.dmFormula,
      },
    ).evaluate();

    return createRollMessage({
      actor: this,
      flavor: game.i18n.localize("EMOKLORE.skillRoll", { skillName }),
      roll,
    });
  }
}

/** 「＊格闘」「★技能：専門」のような判定名を組み立てる */
function formatSkillName(
  { label, isExtra, specialization }: SkillRollContext,
  { base }: { base: boolean },
): string {
  const prefix = base ? "＊" : isExtra ? "★" : "";
  const suffix = specialization ? `${game.i18n.localize("colon")}${specialization}` : "";

  return `${prefix}${label}${suffix}`;
}
