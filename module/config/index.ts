import { preLocalize } from "../utils/localization";
import { baseSkills } from "./base-skills";
import { characteristics } from "./characteristics";
import { emotionAttributes } from "./emotion-attributes";
import { resonantEmotions } from "./resonant-emotions";
import { skillGroups } from "./skill-groups";
import { skillLevels } from "./skill-levels";
import { skills } from "./skills";

export const EMOKLORE = {
  characteristics,
  skillGroups,
  baseSkills,
  skills,
  skillLevel: skillLevels,
  emotionAttributes,
  resonantEmotions,
};

// 各定義の実体から型を導く。Record<string, XConfig> で注釈すると
// キーが string に潰れ、keyof で技能名・能力値名を取り出せなくなる
export type EmokloreConfig = typeof EMOKLORE;

// ローカライゼーションの設定
preLocalize("characteristics", { keys: ["label"] });
preLocalize("skillGroups", { keys: ["label"] });
preLocalize("baseSkills", { keys: ["label"] });
preLocalize("skills", { keys: ["label"] });
preLocalize("skillLevel", { keys: ["label"] });
preLocalize("emotionAttributes", { keys: ["label"] });
preLocalize("resonantEmotions", { keys: ["label"] });
