import type { CharacteristicKey } from "./characteristics";
import type { SkillGroupKey } from "./skill-groups";

export interface BaseSkillConfig {
  label: string;
  characteristic: CharacteristicKey;
  group: SkillGroupKey;
}

const definitions = {
  investigation: {
    label: "EMOKLORE.Config.baseSkills.investigation",
    characteristic: "dexterity",
    group: "investigation",
  },
  perception: {
    label: "EMOKLORE.Config.baseSkills.perception",
    characteristic: "sensitivity",
    group: "perception",
  },
  negotiations: {
    label: "EMOKLORE.Config.baseSkills.negotiations",
    characteristic: "charisma",
    group: "negotiations",
  },
  knowledge: {
    label: "EMOKLORE.Config.baseSkills.knowledge",
    characteristic: "intelligence",
    group: "knowledge",
  },
  news: {
    label: "EMOKLORE.Config.baseSkills.news",
    characteristic: "sociality",
    group: "knowledge",
  },
  athletic: {
    label: "EMOKLORE.Config.baseSkills.athletic",
    characteristic: "physical",
    group: "athletic",
  },
  fight: {
    label: "EMOKLORE.Config.baseSkills.fight",
    characteristic: "physical",
    group: "athletic",
  },
  throw: {
    label: "EMOKLORE.Config.baseSkills.throw",
    characteristic: "dexterity",
    group: "athletic",
  },
  survival: {
    label: "EMOKLORE.Config.baseSkills.survival",
    characteristic: "physical",
    group: "survival",
  },
  self: {
    label: "EMOKLORE.Config.baseSkills.self",
    characteristic: "mentality",
    group: "survival",
  },
  treatment: {
    label: "EMOKLORE.Config.baseSkills.treatment",
    characteristic: "intelligence",
    group: "survival",
  },
  handiwork: {
    label: "EMOKLORE.Config.baseSkills.handiwork",
    characteristic: "dexterity",
    group: "unique",
  },
  luck: {
    label: "EMOKLORE.Config.baseSkills.luck",
    characteristic: "fortune",
    group: "unique",
  },
} satisfies Record<string, BaseSkillConfig>;

export type BaseSkillKey = keyof typeof definitions;

// satisfies だけだと各値が個別の狭い型に推論されるため、値の型は BaseSkillConfig に揃える。
// キーは literal のまま保たれるので BaseSkillKey が使える
export const baseSkills: Record<BaseSkillKey, BaseSkillConfig> = definitions;

/** 基本技能キーかどうか。用途は config/skills.ts の isSkillKey と同じ */
export const isBaseSkillKey = (value: string): value is BaseSkillKey => value in baseSkills;
