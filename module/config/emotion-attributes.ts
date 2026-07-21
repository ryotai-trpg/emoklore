export interface EmotionAttributeConfig {
  label: string;
}

const definitions = {
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
} satisfies Record<string, EmotionAttributeConfig>;

export type EmotionAttributeKey = keyof typeof definitions;

// satisfies だけだと各値が個別の狭い型に推論されるため、値の型は EmotionAttributeConfig に揃える。
// キーは literal のまま保たれるので EmotionAttributeKey が使える
export const emotionAttributes: Record<EmotionAttributeKey, EmotionAttributeConfig> = definitions;
