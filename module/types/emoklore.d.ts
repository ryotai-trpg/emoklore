export {};

interface EmokloreConfig {
  characteristics: Record<string, import("../config/characteristics").CharacteristicConfig>;
  skillGroups: Record<string, import("../config/skill-groups").SkillGroupsConfig>;
  baseSkills: Record<string, import("../config/base-skills").BaseSkillConfig>;
  skills: Record<string, import("../config/skills").SkillConfig>;
  skillLevel: Record<number, import("../config/skill-levels").SkillLevelConfig>;
  emotionAttributes: Record<string, import("../config/emotion-attributes").EmotionAttributesConfig>;
  resonantEmotions: Record<string, import("../config/resonant-emotions").ResonantEmotionsConfig>;
}

// CONFIG は本体 config.mjs のモジュール名前空間なので、モジュール拡張でEMOKLOREを追加する
declare module "@client/config.mjs" {
  export let EMOKLORE: EmokloreConfig;
}
