export interface EmotionAttributesConfig {
  label: string;
}

export const emotionAttributes: Record<string, EmotionAttributesConfig> = {
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
