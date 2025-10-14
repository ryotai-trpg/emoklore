import { preLocalize } from "./helpers/localization";
import type { 
  CharacteristicConfig, 
  SkillGroupsConfig, 
  BaseSkillConfig,
  SkillConfig,
  SkillLevelConfig,
  EmotionAttributesConfig,
  ResonantEmotionsConfig,
} from "./types/emoklore";

export const EMOKLORE = {} as {
  characteristics: Record<string, CharacteristicConfig>;
  skillGroups: Record<string, SkillGroupsConfig>;
  baseSkills: Record<string, BaseSkillConfig>;
  skills: Record<string, SkillConfig>;
  skillLevel: Record<number, SkillLevelConfig>;
  emotionAttributes: Record<string, EmotionAttributesConfig>;
  resonantEmotions: Record<string, ResonantEmotionsConfig>;
};

EMOKLORE.characteristics = {
  physical: {
    label: "EMOKLORE.Actor.characteristics.physical",
    fa: "fa-person-running",
  },
  dexterity: {
    label: "EMOKLORE.Actor.characteristics.dexterity",
    fa: "fa-hand-sparkles",
  },
  mentality: {
    label: "EMOKLORE.Actor.characteristics.mentality",
    fa: "fa-face-meh-blank",
  },
  sensitivity: {
    label: "EMOKLORE.Actor.characteristics.sensitivity",
    fa: "fa-ear-listen",
  },
  intelligence: {
    label: "EMOKLORE.Actor.characteristics.intelligence",
    fa: "fa-book-open",
  },
  charisma: {
    label: "EMOKLORE.Actor.characteristics.charisma",
    fa: "fa-face-kiss-wink-heart",
  },
  sociality: {
    label: "EMOKLORE.Actor.characteristics.sociality",
    fa: "fa-id-card",
  },
  fortune: {
    label: "EMOKLORE.Actor.characteristics.fortune",
    fa: "fa-dice-six",
  },
} as const;
preLocalize("characteristics", { keys: ["label"] });

((EMOKLORE.skillGroups = {
  investigation: {
    label: "EMOKLORE.Actor.skillGroup.investigation",
  },
  perception: {
    label: "EMOKLORE.Actor.skillGroup.perception",
  },
  negotiations: {
    label: "EMOKLORE.Actor.skillGroup.negotiations",
  },
  knowledge: {
    label: "EMOKLORE.Actor.skillGroup.knowledge",
  },
  athletic: {
    label: "EMOKLORE.Actor.skillGroup.athletic",
  },
  survival: {
    label: "EMOKLORE.Actor.skillGroup.survival",
  },
  unique: {
    label: "EMOKLORE.Actor.skillGroup.unique",
  },
}),
  preLocalize("skillGroups", { keys: ["label"] }));

EMOKLORE.baseSkills = {
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
preLocalize("baseSkills", { keys: ["label"] });

EMOKLORE.skills = {
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
preLocalize("skills", { keys: ["label"] });

((EMOKLORE.skillLevel = {
  0: { label: "EMOKLORE.skillLevel.0" },
  1: { label: "EMOKLORE.skillLevel.1" },
  2: { label: "EMOKLORE.skillLevel.2" },
  3: { label: "EMOKLORE.skillLevel.3" },
}),
  preLocalize("skillLevel", { keys: ["label"] }));

EMOKLORE.emotionAttributes = {
  desire: {
    label: "EMOKLORE.emotionAttributes.desire",
  },
  passion: {
    label: "EMOKLORE.emotionAttributes.passion",
  },
  ideal: {
    label: "EMOKLORE.emotionAttributes.ideal",
  },
  relationship: {
    label: "EMOKLORE.emotionAttributes.relationship",
  },
  wound: {
    label: "EMOKLORE.emotionAttributes.wound",
  },
} as const;
preLocalize("emotionAttributes", { keys: ["label"] });

EMOKLORE.resonantEmotions = {
  selfAssertion: {
    label: "EMOKLORE.resonantEmotions.selfAssertion",
    attribute: "desire",
  },
  possession: {
    label: "EMOKLORE.resonantEmotions.possession",
    attribute: "desire",
  },
  instinct: {
    label: "EMOKLORE.resonantEmotions.instinct",
    attribute: "desire",
  },
  destruction: {
    label: "EMOKLORE.resonantEmotions.destruction",
    attribute: "desire",
  },
  superiority: {
    label: "EMOKLORE.resonantEmotions.superiority",
    attribute: "desire",
  },
  sloth: {
    label: "EMOKLORE.resonantEmotions.sloth",
    attribute: "desire",
  },
  escape: {
    label: "EMOKLORE.resonantEmotions.escape",
    attribute: "desire",
  },
  curiosity: {
    label: "EMOKLORE.resonantEmotions.curiosity",
    attribute: "desire",
  },
  thrill: {
    label: "EMOKLORE.resonantEmotions.thrill",
    attribute: "desire",
  },

  joy: {
    label: "EMOKLORE.resonantEmotions.joy",
    attribute: "passion",
  },
  anger: {
    label: "EMOKLORE.resonantEmotions.anger",
    attribute: "passion",
  },
  sorrow: {
    label: "EMOKLORE.resonantEmotions.sorrow",
    attribute: "passion",
  },
  happiness: {
    label: "EMOKLORE.resonantEmotions.happiness",
    attribute: "passion",
  },
  anxiety: {
    label: "EMOKLORE.resonantEmotions.anxiety",
    attribute: "passion",
  },
  disgust: {
    label: "EMOKLORE.resonantEmotions.disgust",
    attribute: "passion",
  },
  fear: {
    label: "EMOKLORE.resonantEmotions.fear",
    attribute: "passion",
  },
  jealousy: {
    label: "EMOKLORE.resonantEmotions.jealousy",
    attribute: "passion",
  },
  grudge: {
    label: "EMOKLORE.resonantEmotions.grudge",
    attribute: "passion",
  },

  justice: {
    label: "EMOKLORE.resonantEmotions.justice",
    attribute: "ideal",
  },
  worship: {
    label: "EMOKLORE.resonantEmotions.worship",
    attribute: "ideal",
  },
  goodAndEvil: {
    label: "EMOKLORE.resonantEmotions.goodAndEvil",
    attribute: "ideal",
  },
  hope: {
    label: "EMOKLORE.resonantEmotions.hope",
    attribute: "ideal",
  },
  aspiration: {
    label: "EMOKLORE.resonantEmotions.aspiration",
    attribute: "ideal",
  },
  reason: {
    label: "EMOKLORE.resonantEmotions.reason",
    attribute: "ideal",
  },
  victory: {
    label: "EMOKLORE.resonantEmotions.victory",
    attribute: "ideal",
  },
  order: {
    label: "EMOKLORE.resonantEmotions.order",
    attribute: "ideal",
  },
  admiration: {
    label: "EMOKLORE.resonantEmotions.admiration",
    attribute: "ideal",
  },
  selflessness: {
    label: "EMOKLORE.resonantEmotions.selflessness",
    attribute: "ideal",
  },

  friendship: {
    label: "EMOKLORE.resonantEmotions.friendship",
    attribute: "relationship",
  },
  love: {
    label: "EMOKLORE.resonantEmotions.love",
    attribute: "relationship",
  },
  romance: {
    label: "EMOKLORE.resonantEmotions.romance",
    attribute: "relationship",
  },
  dependence: {
    label: "EMOKLORE.resonantEmotions.dependence",
    attribute: "relationship",
  },
  respect: {
    label: "EMOKLORE.resonantEmotions.respect",
    attribute: "relationship",
  },
  contempt: {
    label: "EMOKLORE.resonantEmotions.contempt",
    attribute: "relationship",
  },
  protection: {
    label: "EMOKLORE.resonantEmotions.protection",
    attribute: "relationship",
  },
  domination: {
    label: "EMOKLORE.resonantEmotions.domination",
    attribute: "relationship",
  },
  service: {
    label: "EMOKLORE.resonantEmotions.service",
    attribute: "relationship",
  },
  indulgence: {
    label: "EMOKLORE.resonantEmotions.indulgence",
    attribute: "relationship",
  },

  regret: {
    label: "EMOKLORE.resonantEmotions.regret",
    attribute: "wound",
  },
  loneliness: {
    label: "EMOKLORE.resonantEmotions.loneliness",
    attribute: "wound",
  },
  resignation: {
    label: "EMOKLORE.resonantEmotions.resignation",
    attribute: "wound",
  },
  despair: {
    label: "EMOKLORE.resonantEmotions.despair",
    attribute: "wound",
  },
  denial: {
    label: "EMOKLORE.resonantEmotions.denial",
    attribute: "wound",
  },
  doubt: {
    label: "EMOKLORE.resonantEmotions.doubt",
    attribute: "wound",
  },
  guilt: {
    label: "EMOKLORE.resonantEmotions.guilt",
    attribute: "wound",
  },
  madness: {
    label: "EMOKLORE.resonantEmotions.madness",
    attribute: "wound",
  },
  inferiorityComplex: {
    label: "EMOKLORE.resonantEmotions.inferiorityComplex",
    attribute: "wound",
  },
} as const;
preLocalize("resonantEmotions", { keys: ["label"] });
