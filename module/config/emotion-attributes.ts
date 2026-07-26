export interface EmotionAttributeConfig {
  label: string;
}

const definitions = {
  desire: {
    label: "EMOKLORE.Config.emotionAttributes.desire",
  },
  passion: {
    label: "EMOKLORE.Config.emotionAttributes.passion",
  },
  ideal: {
    label: "EMOKLORE.Config.emotionAttributes.ideal",
  },
  relationship: {
    label: "EMOKLORE.Config.emotionAttributes.relationship",
  },
  wound: {
    label: "EMOKLORE.Config.emotionAttributes.wound",
  },
} satisfies Record<string, EmotionAttributeConfig>;

export type EmotionAttributeKey = keyof typeof definitions;

// satisfies だけだと各値が個別の狭い型に推論されるため、値の型は EmotionAttributeConfig に揃える。
// キーは literal のまま保たれるので EmotionAttributeKey が使える
export const emotionAttributes: Record<EmotionAttributeKey, EmotionAttributeConfig> = definitions;
