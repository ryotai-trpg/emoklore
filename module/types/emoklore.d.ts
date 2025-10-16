export interface CharacteristicConfig {
  label: string;
  fa: string;
}

export interface SkillGroupsConfig {
  label: string;
}

export interface BaseSkillConfig {
  label: string;
  characteristic: keyof typeof EMOKLORE.characteristics;
  group: keyof typeof EMOKLORE.skillGroups;
}

export interface SkillConfig {
  label: string;
  characteristic?: keyof typeof EMOKLORE.characteristics;
  characteristicOptions?: (keyof typeof EMOKLORE.characteristics)[];
  group: keyof typeof EMOKLORE.skillGroups;
  isExtra?: boolean;
}

export interface SkillLevelConfig {
  label: string;
}

export interface EmotionAttributesConfig {
  label: string;
}

export interface ResonantEmotionsConfig {
  label: string;
  attribute: keyof typeof EMOKLORE.emotionAttributes;
}

declare global {
  namespace CONFIG {
    interface EmokloreConfig {
      characteristics: Record<string, CharacteristicConfig>;
      skillGroups: Record<string, SkillGroupsConfig>;
      baseSkills: Record<string, BaseSkillConfig>;
      skills: Record<string, SkillConfig>;
      skillLevel: Record<number, SkillLevelConfig>;
      emotionAttributes: Record<string, EmotionAttributesConfig>;
      resonantEmotions: Record<string, ResonantEmotionsConfig>;
    }
    var EMOKLORE: EmokloreConfig;
  }
}
