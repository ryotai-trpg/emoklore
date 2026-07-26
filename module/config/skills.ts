import type { CharacteristicKey } from "./characteristics";
import type { SkillGroupKey } from "./skill-groups";

export interface SkillConfig {
  label: string;
  characteristic?: CharacteristicKey;
  characteristicOptions?: CharacteristicKey[];
  group: SkillGroupKey;
  isExtra?: boolean;
  hasSpecialization?: boolean;
}

const definitions = {
  search: {
    label: "EMOKLORE.Config.skills.search",
    characteristic: "intelligence",
    group: "investigation",
  },
  insight: {
    label: "EMOKLORE.Config.skills.insight",
    characteristic: "intelligence",
    group: "investigation",
  },
  mapping: {
    label: "EMOKLORE.Config.skills.mapping",
    characteristicOptions: ["dexterity", "sensitivity"],
    group: "investigation",
  },
  instinct: {
    label: "EMOKLORE.Config.skills.instinct",
    characteristic: "mentality",
    group: "investigation",
  },
  appraisal: {
    label: "EMOKLORE.Config.skills.appraisal",
    characteristic: "sensitivity",
    group: "investigation",
  },

  keenObservation: {
    label: "EMOKLORE.Config.skills.keenObservation",
    characteristic: "sensitivity",
    group: "perception",
  },
  listen: {
    label: "EMOKLORE.Config.skills.listen",
    characteristic: "sensitivity",
    group: "perception",
  },
  taste: {
    label: "EMOKLORE.Config.skills.taste",
    characteristic: "sensitivity",
    group: "perception",
  },
  threatDetection: {
    label: "EMOKLORE.Config.skills.threatDetection",
    characteristicOptions: ["sensitivity", "fortune"],
    group: "perception",
  },
  spiritualSense: {
    label: "EMOKLORE.Config.skills.spiritualSense",
    characteristicOptions: ["mentality", "fortune"],
    group: "perception",
    isExtra: true,
  },

  etiquette: {
    label: "EMOKLORE.Config.skills.etiquette",
    characteristic: "sociality",
    group: "negotiations",
  },
  debate: {
    label: "EMOKLORE.Config.skills.debate",
    characteristic: "intelligence",
    group: "negotiations",
  },
  charm: {
    label: "EMOKLORE.Config.skills.charm",
    characteristic: "charisma",
    group: "negotiations",
  },
  psychology: {
    label: "EMOKLORE.Config.skills.psychology",
    characteristicOptions: ["mentality", "intelligence"],
    group: "negotiations",
  },

  specializedKnowledge: {
    label: "EMOKLORE.Config.skills.specializedKnowledge",
    characteristic: "intelligence",
    group: "knowledge",
    hasSpecialization: true,
  },
  insider: {
    label: "EMOKLORE.Config.skills.insider",
    characteristicOptions: ["sensitivity", "sociality"],
    group: "knowledge",
  },
  industryKnowledge: {
    label: "EMOKLORE.Config.skills.industryKnowledge",
    characteristicOptions: ["sociality", "charisma"],
    group: "knowledge",
    hasSpecialization: true,
  },

  speed: {
    label: "EMOKLORE.Config.skills.speed",
    characteristic: "physical",
    group: "athletic",
  },
  strength: {
    label: "EMOKLORE.Config.skills.strength",
    characteristic: "physical",
    group: "athletic",
  },
  acrobatics: {
    label: "EMOKLORE.Config.skills.acrobatics",
    characteristicOptions: ["physical", "dexterity"],
    group: "athletic",
  },
  dive: {
    label: "EMOKLORE.Config.skills.dive",
    characteristic: "physical",
    group: "athletic",
  },
  martialArt: {
    label: "EMOKLORE.Config.skills.martialArt",
    characteristic: "physical",
    group: "athletic",
    hasSpecialization: true,
  },
  secretTechnique: {
    label: "EMOKLORE.Config.skills.secretTechnique",
    characteristicOptions: ["physical", "mentality", "dexterity"],
    group: "athletic",
    isExtra: true,
    hasSpecialization: true,
  },
  rangedAttack: {
    label: "EMOKLORE.Config.skills.rangedAttack",
    characteristicOptions: ["dexterity", "sensitivity"],
    group: "athletic",
    isExtra: true,
    hasSpecialization: true,
  },

  endurance: {
    label: "EMOKLORE.Config.skills.endurance",
    characteristic: "physical",
    group: "survival",
  },
  grit: {
    label: "EMOKLORE.Config.skills.grit",
    characteristic: "mentality",
    group: "survival",
  },
  medicine: {
    label: "EMOKLORE.Config.skills.medicine",
    characteristicOptions: ["dexterity", "intelligence"],
    group: "survival",
  },
  resurrection: {
    label: "EMOKLORE.Config.skills.resurrection",
    characteristicOptions: ["intelligence", "mentality"],
    group: "survival",
    isExtra: true,
  },

  technique: {
    label: "EMOKLORE.Config.skills.technique",
    characteristic: "dexterity",
    group: "unique",
    hasSpecialization: true,
  },
  art: {
    label: "EMOKLORE.Config.skills.art",
    characteristicOptions: ["dexterity", "mentality", "sensitivity"],
    group: "unique",
    hasSpecialization: true,
  },
  pilot: {
    label: "EMOKLORE.Config.skills.pilot",
    characteristicOptions: ["dexterity", "sensitivity", "intelligence"],
    group: "unique",
    hasSpecialization: true,
  },
  cipher: {
    label: "EMOKLORE.Config.skills.cipher",
    characteristic: "intelligence",
    group: "unique",
  },
  computer: {
    label: "EMOKLORE.Config.skills.computer",
    characteristic: "intelligence",
    group: "unique",
  },
  stealth: {
    label: "EMOKLORE.Config.skills.stealth",
    characteristicOptions: ["dexterity", "sociality", "fortune"],
    group: "unique",
  },
  strongLuck: {
    label: "EMOKLORE.Config.skills.strongLuck",
    characteristic: "fortune",
    group: "unique",
    isExtra: true,
  },
} satisfies Record<string, SkillConfig>;

export type SkillKey = keyof typeof definitions;

// satisfies だけだと各値が個別の狭い型に推論されるため、値の型は SkillConfig に揃える。
// キーは literal のまま保たれるので SkillKey が使える
export const skills: Record<SkillKey, SkillConfig> = definitions;

/**
 * 技能キーかどうか。DOMのdatasetや保存データなど、外から来た文字列を
 * SkillKey として扱う前に必ずここを通す。
 */
export const isSkillKey = (value: string): value is SkillKey => value in skills;

/**
 * スキーマの choices に渡す表。値は翻訳済み文字列ではなくi18nキーを入れる。
 *
 * `characteristicChoices` と同じ扱い。描画時に formInput の localize が解決する。
 */
export const skillChoices: Record<string, string> = Object.fromEntries(
  Object.entries(definitions).map(([key, { label }]) => [key, label]),
);
