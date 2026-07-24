import type { EmotionAttributeKey } from "./emotion-attributes";

export interface ResonantEmotionConfig {
  label: string;
  attribute: EmotionAttributeKey;
}

const definitions = {
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
