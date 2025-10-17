import type { EmokloreConfig } from "../config";

declare global {
  namespace CONFIG {
    interface EmokloreConfig {
      characteristics: Record<string, import("../config/characteristics").CharacteristicConfig>;
      skillGroups: Record<string, import("../config/skill-groups").SkillGroupsConfig>;
      baseSkills: Record<string, import("../config/base-skills").BaseSkillConfig>;
      skills: Record<string, import("../config/skills").SkillConfig>;
      skillLevel: Record<number, import("../config/skill-levels").SkillLevelConfig>;
      emotionAttributes: Record<string, import("../config/emotion-attributes").EmotionAttributesConfig>;
      resonantEmotions: Record<string, import("../config/resonant-emotions").ResonantEmotionsConfig>;
    }
    var EMOKLORE: EmokloreConfig;
  }
}
