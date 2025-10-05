import { preLocalize } from "./helpers/localization.mjs";

export const EMOKLORE = {};

EMOKLORE.characteristics = {
  physical: {
    label: "EMOKLORE.Actor.characteristics.physical",
    emoji: "💪",
  },
  dexterity: {
    label: "EMOKLORE.Actor.characteristics.dexterity",
    emoji: "👌",
  },
  mentality: {
    label: "EMOKLORE.Actor.characteristics.mentality",
    emoji: "😶",
  },
  sensitivity: {
    label: "EMOKLORE.Actor.characteristics.sensitivity",
    emoji: "🦻",
  },
  intelligence: {
    label: "EMOKLORE.Actor.characteristics.intelligence",
    emoji: "📖",
  },
  charisma: {
    label: "EMOKLORE.Actor.characteristics.charisma",
    emoji: "❤️",
  },
  sociality: {
    label: "EMOKLORE.Actor.characteristics.sociality",
    emoji: "🎫",
  },
  fortune: {
    label: "EMOKLORE.Actor.characteristics.fortune",
    emoji: "🎲",
  },
};
preLocalize("characteristics", { keys: ["label"] });

EMOKLORE.baseSkills = {
  investigation: {
    label: "EMOKLORE.Actor.baseSkills.investigation",
    characteristic: "dexterity",
  },
  perception: {
    label: "EMOKLORE.Actor.baseSkills.perception",
    characteristic: "sensitivity",
  },
  negotiations: {
    label: "EMOKLORE.Actor.baseSkills.negotiations",
    characteristic: "charisma",
  },
  knowledge: {
    label: "EMOKLORE.Actor.baseSkills.knowledge",
    characteristic: "intelligence",
  },
  news: {
    label: "EMOKLORE.Actor.baseSkills.news",
    characteristic: "sociality",
  },
  exercise: {
    label: "EMOKLORE.Actor.baseSkills.exercise",
    characteristic: "physical",
  },
  fight: {
    label: "EMOKLORE.Actor.baseSkills.fight",
    characteristic: "physical",
  },
  throw: {
    label: "EMOKLORE.Actor.baseSkills.throw",
    characteristic: "dexterity",
  },
  survival: {
    label: "EMOKLORE.Actor.baseSkills.survival",
    characteristic: "physical",
  },
  self: {
    label: "EMOKLORE.Actor.baseSkills.self",
    characteristic: "mentality",
  },
  treatment: {
    label: "EMOKLORE.Actor.baseSkills.treatment",
    characteristic: "intelligence",
  },
  handiwork: {
    label: "EMOKLORE.Actor.baseSkills.handiwork",
    characteristic: "dexterity",
  },
  luck: {
    label: "EMOKLORE.Actor.baseSkills.luck",
    characteristic: "fortune",
  },
};
preLocalize("baseSkills", { keys: ["label"] });

EMOKLORE.skills = {
  search: {
    label: "EMOKLORE.Actor.skills.search",
    characteristic: "intelligence",
  },
  insight: {
    label: "EMOKLORE.Actor.skills.insight",
    characteristic: "intelligence",
  },
  mapping: {
    label: "EMOKLORE.Actor.skills.mapping",
    characteristic: "dexterity",
  },
  instinct: {
    label: "EMOKLORE.Actor.skills.instinct",
    characteristic: "mentality",
  },
  appraisal: {
    label: "EMOKLORE.Actor.skills.appraisal",
    characteristic: "sensitivity",
  },
};
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
};
preLocalize("emotionAttributes", { keys: ["label"] });

EMOKLORE.sympatheticEmotion = {
  selfAssertion: {
    label: "EMOKLORE.sympatheticEmotion.selfAssertion",
    attribute: "desire",
  },
  possession: {
    label: "EMOKLORE.sympatheticEmotion.possession",
    attribute: "desire",
  },
  instinct: {
    label: "EMOKLORE.sympatheticEmotion.instinct",
    attribute: "desire",
  },
  destruction: {
    label: "EMOKLORE.sympatheticEmotion.destruction",
    attribute: "desire",
  },
  superiority: {
    label: "EMOKLORE.sympatheticEmotion.superiority",
    attribute: "desire",
  },
  sloth: {
    label: "EMOKLORE.sympatheticEmotion.sloth",
    attribute: "desire",
  },
  escape: {
    label: "EMOKLORE.sympatheticEmotion.escape",
    attribute: "desire",
  },
  curiosity: {
    label: "EMOKLORE.sympatheticEmotion.curiosity",
    attribute: "desire",
  },
  thrill: {
    label: "EMOKLORE.sympatheticEmotion.thrill",
    attribute: "desire",
  },

  joy: {
    label: "EMOKLORE.sympatheticEmotion.joy",
    attribute: "passion",
  },
  anger: {
    label: "EMOKLORE.sympatheticEmotion.anger",
    attribute: "passion",
  },
  sorrow: {
    label: "EMOKLORE.sympatheticEmotion.sorrow",
    attribute: "passion",
  },
  happiness: {
    label: "EMOKLORE.sympatheticEmotion.happiness",
    attribute: "passion",
  },
  anxiety: {
    label: "EMOKLORE.sympatheticEmotion.anxiety",
    attribute: "passion",
  },
  disgust: {
    label: "EMOKLORE.sympatheticEmotion.disgust",
    attribute: "passion",
  },
  fear: {
    label: "EMOKLORE.sympatheticEmotion.fear",
    attribute: "passion",
  },
  jealousy: {
    label: "EMOKLORE.sympatheticEmotion.jealousy",
    attribute: "passion",
  },
  grudge: {
    label: "EMOKLORE.sympatheticEmotion.grudge",
    attribute: "passion",
  },

  justice: {
    label: "EMOKLORE.sympatheticEmotion.justice",
    attribute: "ideal",
  },
  worship: {
    label: "EMOKLORE.sympatheticEmotion.worship",
    attribute: "ideal",
  },
  goodAndEvil: {
    label: "EMOKLORE.sympatheticEmotion.goodAndEvil",
    attribute: "ideal",
  },
  hope: {
    label: "EMOKLORE.sympatheticEmotion.hope",
    attribute: "ideal",
  },
  aspiration: {
    label: "EMOKLORE.sympatheticEmotion.aspiration",
    attribute: "ideal",
  },
  reason: {
    label: "EMOKLORE.sympatheticEmotion.reason",
    attribute: "ideal",
  },
  victory: {
    label: "EMOKLORE.sympatheticEmotion.victory",
    attribute: "ideal",
  },
  order: {
    label: "EMOKLORE.sympatheticEmotion.order",
    attribute: "ideal",
  },
  admiration: {
    label: "EMOKLORE.sympatheticEmotion.admiration",
    attribute: "ideal",
  },
  selflessness: {
    label: "EMOKLORE.sympatheticEmotion.selflessness",
    attribute: "ideal",
  },

  friendship: {
    label: "EMOKLORE.sympatheticEmotion.friendship",
    attribute: "relationship",
  },
  love: {
    label: "EMOKLORE.sympatheticEmotion.love",
    attribute: "relationship",
  },
  romance: {
    label: "EMOKLORE.sympatheticEmotion.romance",
    attribute: "relationship",
  },
  dependence: {
    label: "EMOKLORE.sympatheticEmotion.dependence",
    attribute: "relationship",
  },
  respect: {
    label: "EMOKLORE.sympatheticEmotion.respect",
    attribute: "relationship",
  },
  contempt: {
    label: "EMOKLORE.sympatheticEmotion.contempt",
    attribute: "relationship",
  },
  protection: {
    label: "EMOKLORE.sympatheticEmotion.protection",
    attribute: "relationship",
  },
  domination: {
    label: "EMOKLORE.sympatheticEmotion.domination",
    attribute: "relationship",
  },
  service: {
    label: "EMOKLORE.sympatheticEmotion.service",
    attribute: "relationship",
  },
  indulgence: {
    label: "EMOKLORE.sympatheticEmotion.indulgence",
    attribute: "relationship",
  },

  regret: {
    label: "EMOKLORE.sympatheticEmotion.regret",
    attribute: "wound",
  },
  loneliness: {
    label: "EMOKLORE.sympatheticEmotion.loneliness",
    attribute: "wound",
  },
  resignation: {
    label: "EMOKLORE.sympatheticEmotion.resignation",
    attribute: "wound",
  },
  despair: {
    label: "EMOKLORE.sympatheticEmotion.despair",
    attribute: "wound",
  },
  denial: {
    label: "EMOKLORE.sympatheticEmotion.denial",
    attribute: "wound",
  },
  doubt: {
    label: "EMOKLORE.sympatheticEmotion.doubt",
    attribute: "wound",
  },
  guilt: {
    label: "EMOKLORE.sympatheticEmotion.guilt",
    attribute: "wound",
  },
  madness: {
    label: "EMOKLORE.sympatheticEmotion.madness",
    attribute: "wound",
  },
  inferiorityComplex: {
    label: "EMOKLORE.sympatheticEmotion.inferiorityComplex",
    attribute: "wound",
  },
};
preLocalize("sympatheticEmotion", { keys: ["label"] });
