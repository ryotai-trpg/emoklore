export interface BaseSkillConfig {
  label: string;
  characteristic: string;
  group: string;
}

export const baseSkills: Record<string, BaseSkillConfig> = {
  investigation: {
    label: "EMOKLORE.Actor.baseSkills.investigation",
    characteristic: "dexterity",
    group: "investigation",
  },
  perception: {
    label: "EMOKLORE.Actor.baseSkills.perception",
    characteristic: "sensitivity",
    group: "perception",
  },
  negotiations: {
    label: "EMOKLORE.Actor.baseSkills.negotiations",
    characteristic: "charisma",
    group: "negotiations",
  },
  knowledge: {
    label: "EMOKLORE.Actor.baseSkills.knowledge",
    characteristic: "intelligence",
    group: "knowledge",
  },
  news: {
    label: "EMOKLORE.Actor.baseSkills.news",
    characteristic: "sociality",
    group: "knowledge",
  },
  athletic: {
    label: "EMOKLORE.Actor.baseSkills.athletic",
    characteristic: "physical",
    group: "athletic",
  },
  fight: {
    label: "EMOKLORE.Actor.baseSkills.fight",
    characteristic: "physical",
    group: "athletic",
  },
  throw: {
    label: "EMOKLORE.Actor.baseSkills.throw",
    characteristic: "dexterity",
    group: "athletic",
  },
  survival: {
    label: "EMOKLORE.Actor.baseSkills.survival",
    characteristic: "physical",
    group: "survival",
  },
  self: {
    label: "EMOKLORE.Actor.baseSkills.self",
    characteristic: "mentality",
    group: "survival",
  },
  treatment: {
    label: "EMOKLORE.Actor.baseSkills.treatment",
    characteristic: "intelligence",
    group: "survival",
  },
  handiwork: {
    label: "EMOKLORE.Actor.baseSkills.handiwork",
    characteristic: "dexterity",
    group: "unique",
  },
  luck: {
    label: "EMOKLORE.Actor.baseSkills.luck",
    characteristic: "fortune",
    group: "unique",
  },
} as const;
