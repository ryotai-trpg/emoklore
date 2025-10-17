export interface SkillConfig {
  label: string;
  characteristic?: string;
  characteristicOptions?: string[];
  group: string;
  isExtra?: boolean;
}

export const skills: Record<string, SkillConfig> = {
  search: {
    label: "EMOKLORE.Actor.skills.search",
    characteristic: "intelligence",
    group: "investigation",
  },
  insight: {
    label: "EMOKLORE.Actor.skills.insight",
    characteristic: "intelligence",
    group: "investigation",
  },
  mapping: {
    label: "EMOKLORE.Actor.skills.mapping",
    characteristicOptions: ["dexterity", "sensitivity"],
    group: "investigation",
  },
  instinct: {
    label: "EMOKLORE.Actor.skills.instinct",
    characteristic: "mentality",
    group: "investigation",
  },
  appraisal: {
    label: "EMOKLORE.Actor.skills.appraisal",
    characteristic: "sensitivity",
    group: "investigation",
  },

  keenObservation: {
    label: "EMOKLORE.Actor.skills.keenObservation",
    characteristic: "sensitivity",
    group: "perception",
  },
  listen: {
    label: "EMOKLORE.Actor.skills.listen",
    characteristic: "sensitivity",
    group: "perception",
  },
  taste: {
    label: "EMOKLORE.Actor.skills.taste",
    characteristic: "sensitivity",
    group: "perception",
  },
  threatDetection: {
    label: "EMOKLORE.Actor.skills.threatDetection",
    characteristicOptions: ["sensitivity", "fortune"],
    group: "perception",
  },
  spiritualSense: {
    label: "EMOKLORE.Actor.skills.spiritualSense",
    characteristicOptions: ["mentality", "fortune"],
    group: "perception",
    isExtra: true,
  },

  etiquette: {
    label: "EMOKLORE.Actor.skills.etiquette",
    characteristic: "sociality",
    group: "negotiations",
  },
  debate: {
    label: "EMOKLORE.Actor.skills.debate",
    characteristic: "intelligence",
    group: "negotiations",
  },
  charm: {
    label: "EMOKLORE.Actor.skills.charm",
    characteristic: "charisma",
    group: "negotiations",
  },
  psychology: {
    label: "EMOKLORE.Actor.skills.psychology",
    characteristicOptions: ["mentality", "intelligence"],
    group: "negotiations",
  },

  specializedKnowledge: {
    label: "EMOKLORE.Actor.skills.specializedKnowledge",
    characteristic: "intelligence",
    group: "knowledge",
  },
  insider: {
    label: "EMOKLORE.Actor.skills.insider",
    characteristicOptions: ["sensitivity", "sociality"],
    group: "knowledge",
  },
  industryKnowledge: {
    label: "EMOKLORE.Actor.skills.industryKnowledge",
    characteristicOptions: ["sociality", "charisma"],
    group: "knowledge",
  },

  speed: {
    label: "EMOKLORE.Actor.skills.speed",
    characteristic: "physical",
    group: "athletic",
  },
  strength: {
    label: "EMOKLORE.Actor.skills.strength",
    characteristic: "physical",
    group: "athletic",
  },
  acrobatics: {
    label: "EMOKLORE.Actor.skills.acrobatics",
    characteristicOptions: ["physical", "dexterity"],
    group: "athletic",
  },
  dive: {
    label: "EMOKLORE.Actor.skills.dive",
    characteristic: "physical",
    group: "athletic",
  },
  martialArt: {
    label: "EMOKLORE.Actor.skills.martialArt",
    characteristic: "physical",
    group: "athletic",
  },
  secretTechnique: {
    label: "EMOKLORE.Actor.skills.secretTechnique",
    characteristicOptions: ["physical", "mentality", "dexterity"],
    group: "athletic",
    isExtra: true,
  },
  rangedAttack: {
    label: "EMOKLORE.Actor.skills.rangedAttack",
    characteristicOptions: ["dexterity", "sensitivity"],
    group: "athletic",
    isExtra: true,
  },

  endurance: {
    label: "EMOKLORE.Actor.skills.endurance",
    characteristic: "physical",
    group: "survival",
  },
  grit: {
    label: "EMOKLORE.Actor.skills.grit",
    characteristic: "mentality",
    group: "survival",
  },
  medicine: {
    label: "EMOKLORE.Actor.skills.medicine",
    characteristicOptions: ["dexterity", "intelligence"],
    group: "survival",
  },
  resurrection: {
    label: "EMOKLORE.Actor.skills.resurrection",
    characteristicOptions: ["intelligence", "mentality"],
    group: "survival",
    isExtra: true,
  },

  technique: {
    label: "EMOKLORE.Actor.skills.technique",
    characteristic: "dexterity",
    group: "unique",
  },
  art: {
    label: "EMOKLORE.Actor.skills.art",
    characteristicOptions: ["dexterity", "mentality", "sensitivity"],
    group: "unique",
  },
  pilot: {
    label: "EMOKLORE.Actor.skills.pilot",
    characteristicOptions: ["dexterity", "sensitivity", "intelligence"],
    group: "unique",
  },
  cipher: {
    label: "EMOKLORE.Actor.skills.cipher",
    characteristic: "intelligence",
    group: "unique",
  },
  computer: {
    label: "EMOKLORE.Actor.skills.computer",
    characteristic: "intelligence",
    group: "unique",
  },
  stealth: {
    label: "EMOKLORE.Actor.skills.stealth",
    characteristicOptions: ["dexterity", "sociality", "fortune"],
    group: "unique",
  },
  strongLuck: {
    label: "EMOKLORE.Actor.skills.strongLuck",
    characteristic: "fortune",
    group: "unique",
    isExtra: true,
  },
} as const;
