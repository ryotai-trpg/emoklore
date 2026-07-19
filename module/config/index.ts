import { preLocalize } from "../utils/localization";
import { type BaseSkillConfig, baseSkills } from "./base-skills";
import { type CharacteristicConfig, characteristics } from "./characteristics";
import { type EmotionAttributesConfig, emotionAttributes } from "./emotion-attributes";
import { type ResonantEmotionsConfig, resonantEmotions } from "./resonant-emotions";
import { type SkillGroupsConfig, skillGroups } from "./skill-groups";
import { type SkillLevelConfig, skillLevels } from "./skill-levels";
import { type SkillConfig, skills } from "./skills";

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
