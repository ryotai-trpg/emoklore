import { preLocalize } from "../helpers/localization";
import { characteristics, type CharacteristicConfig } from "./characteristics";
import { skillGroups, type SkillGroupsConfig } from "./skill-groups";
import { baseSkills, type BaseSkillConfig } from "./base-skills";
import { skills, type SkillConfig } from "./skills";
import { skillLevels, type SkillLevelConfig } from "./skill-levels";
import { emotionAttributes, type EmotionAttributesConfig } from "./emotion-attributes";
import { resonantEmotions, type ResonantEmotionsConfig } from "./resonant-emotions";

export interface EmokloreConfig {
  characteristics: Record<string, CharacteristicConfig>;
  skillGroups: Record<string, SkillGroupsConfig>;
  baseSkills: Record<string, BaseSkillConfig>;
  skills: Record<string, SkillConfig>;
  skillLevel: Record<number, SkillLevelConfig>;
  emotionAttributes: Record<string, EmotionAttributesConfig>;
  resonantEmotions: Record<string, ResonantEmotionsConfig>;
}

export const EMOKLORE: EmokloreConfig = {
  characteristics,
  skillGroups,
  baseSkills,
  skills,
  skillLevel: skillLevels,
  emotionAttributes,
  resonantEmotions,
};

// ローカライゼーションの設定
preLocalize("characteristics", { keys: ["label"] });
preLocalize("skillGroups", { keys: ["label"] });
preLocalize("baseSkills", { keys: ["label"] });
preLocalize("skills", { keys: ["label"] });
preLocalize("skillLevel", { keys: ["label"] });
preLocalize("emotionAttributes", { keys: ["label"] });
preLocalize("resonantEmotions", { keys: ["label"] });
