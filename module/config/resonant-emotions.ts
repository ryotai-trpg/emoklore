import type { EmotionAttributeKey } from "./emotion-attributes";

export interface ResonantEmotionConfig {
  label: string;
  attribute: EmotionAttributeKey;
}

const definitions = {
  selfAssertion: {
    label: "EMOKLORE.Config.resonantEmotions.selfAssertion",
    attribute: "desire",
  },
  possession: {
    label: "EMOKLORE.Config.resonantEmotions.possession",
    attribute: "desire",
  },
  instinct: {
    label: "EMOKLORE.Config.resonantEmotions.instinct",
    attribute: "desire",
  },
  destruction: {
    label: "EMOKLORE.Config.resonantEmotions.destruction",
    attribute: "desire",
  },
  superiority: {
    label: "EMOKLORE.Config.resonantEmotions.superiority",
    attribute: "desire",
  },
  sloth: {
    label: "EMOKLORE.Config.resonantEmotions.sloth",
    attribute: "desire",
  },
  escape: {
    label: "EMOKLORE.Config.resonantEmotions.escape",
    attribute: "desire",
  },
  curiosity: {
    label: "EMOKLORE.Config.resonantEmotions.curiosity",
    attribute: "desire",
  },
  thrill: {
    label: "EMOKLORE.Config.resonantEmotions.thrill",
    attribute: "desire",
  },

  joy: {
    label: "EMOKLORE.Config.resonantEmotions.joy",
    attribute: "passion",
  },
  anger: {
    label: "EMOKLORE.Config.resonantEmotions.anger",
    attribute: "passion",
  },
  sorrow: {
    label: "EMOKLORE.Config.resonantEmotions.sorrow",
    attribute: "passion",
  },
  happiness: {
    label: "EMOKLORE.Config.resonantEmotions.happiness",
    attribute: "passion",
  },
  anxiety: {
    label: "EMOKLORE.Config.resonantEmotions.anxiety",
    attribute: "passion",
  },
  disgust: {
    label: "EMOKLORE.Config.resonantEmotions.disgust",
    attribute: "passion",
  },
  fear: {
    label: "EMOKLORE.Config.resonantEmotions.fear",
    attribute: "passion",
  },
  jealousy: {
    label: "EMOKLORE.Config.resonantEmotions.jealousy",
    attribute: "passion",
  },
  grudge: {
    label: "EMOKLORE.Config.resonantEmotions.grudge",
    attribute: "passion",
  },

  justice: {
    label: "EMOKLORE.Config.resonantEmotions.justice",
    attribute: "ideal",
  },
  worship: {
    label: "EMOKLORE.Config.resonantEmotions.worship",
    attribute: "ideal",
  },
  goodAndEvil: {
    label: "EMOKLORE.Config.resonantEmotions.goodAndEvil",
    attribute: "ideal",
  },
  hope: {
    label: "EMOKLORE.Config.resonantEmotions.hope",
    attribute: "ideal",
  },
  aspiration: {
    label: "EMOKLORE.Config.resonantEmotions.aspiration",
    attribute: "ideal",
  },
  reason: {
    label: "EMOKLORE.Config.resonantEmotions.reason",
    attribute: "ideal",
  },
  victory: {
    label: "EMOKLORE.Config.resonantEmotions.victory",
    attribute: "ideal",
  },
  order: {
    label: "EMOKLORE.Config.resonantEmotions.order",
    attribute: "ideal",
  },
  admiration: {
    label: "EMOKLORE.Config.resonantEmotions.admiration",
    attribute: "ideal",
  },
  selflessness: {
    label: "EMOKLORE.Config.resonantEmotions.selflessness",
    attribute: "ideal",
  },

  friendship: {
    label: "EMOKLORE.Config.resonantEmotions.friendship",
    attribute: "relationship",
  },
  love: {
    label: "EMOKLORE.Config.resonantEmotions.love",
    attribute: "relationship",
  },
  romance: {
    label: "EMOKLORE.Config.resonantEmotions.romance",
    attribute: "relationship",
  },
  dependence: {
    label: "EMOKLORE.Config.resonantEmotions.dependence",
    attribute: "relationship",
  },
  respect: {
    label: "EMOKLORE.Config.resonantEmotions.respect",
    attribute: "relationship",
  },
  contempt: {
    label: "EMOKLORE.Config.resonantEmotions.contempt",
    attribute: "relationship",
  },
  protection: {
    label: "EMOKLORE.Config.resonantEmotions.protection",
    attribute: "relationship",
  },
  domination: {
    label: "EMOKLORE.Config.resonantEmotions.domination",
    attribute: "relationship",
  },
  service: {
    label: "EMOKLORE.Config.resonantEmotions.service",
    attribute: "relationship",
  },
  indulgence: {
    label: "EMOKLORE.Config.resonantEmotions.indulgence",
    attribute: "relationship",
  },

  regret: {
    label: "EMOKLORE.Config.resonantEmotions.regret",
    attribute: "wound",
  },
  loneliness: {
    label: "EMOKLORE.Config.resonantEmotions.loneliness",
    attribute: "wound",
  },
  resignation: {
    label: "EMOKLORE.Config.resonantEmotions.resignation",
    attribute: "wound",
  },
  despair: {
    label: "EMOKLORE.Config.resonantEmotions.despair",
    attribute: "wound",
  },
  denial: {
    label: "EMOKLORE.Config.resonantEmotions.denial",
    attribute: "wound",
  },
  doubt: {
    label: "EMOKLORE.Config.resonantEmotions.doubt",
    attribute: "wound",
  },
  guilt: {
    label: "EMOKLORE.Config.resonantEmotions.guilt",
    attribute: "wound",
  },
  madness: {
    label: "EMOKLORE.Config.resonantEmotions.madness",
    attribute: "wound",
  },
  inferiorityComplex: {
    label: "EMOKLORE.Config.resonantEmotions.inferiorityComplex",
    attribute: "wound",
  },
} satisfies Record<string, ResonantEmotionConfig>;

export type ResonantEmotionKey = keyof typeof definitions;

/**
 * 共鳴感情のキーかどうか。
 *
 * 怪異の感情（SetField）やピッカーから読み戻す文字列は保存データ・フォーム由来で、
 * 宣言した型を裏切りうる。CONFIG を引く前にここを通す。
 */
export const isResonantEmotionKey = (value: string): value is ResonantEmotionKey =>
  value in definitions;

// satisfies だけだと各値が個別の狭い型に推論されるため、値の型は ResonantEmotionConfig に揃える。
// キーは literal のまま保たれるので ResonantEmotionKey が使える
export const resonantEmotions: Record<ResonantEmotionKey, ResonantEmotionConfig> = definitions;
