import { preLocalize } from "../utils/localization";
import { attackSkills } from "./attack-skills";
import { baseSkills } from "./base-skills";
import { characteristics } from "./characteristics";
import { emotionAttributes } from "./emotion-attributes";
import { initiativePresets } from "./initiative";
import { resonantEmotions } from "./resonant-emotions";
import { skillGroups } from "./skill-groups";
import { skills } from "./skills";

export const EMOKLORE = {
  characteristics,
  skillGroups,
  baseSkills,
  skills,
  attackSkills,
  emotionAttributes,
  resonantEmotions,
  initiativePresets,
};

// 各定義の実体から型を導く。Record<string, XConfig> で注釈すると
// キーが string に潰れ、keyof で技能名・能力値名を取り出せなくなる
export type EmokloreConfig = typeof EMOKLORE;

// ローカライゼーションの設定。
//
// **ここに並ぶ表だけが `label` を持つ。** i18nInit で翻訳済みの文字列に差し替わるので、
// 読む側は素で使える。対象外の表（attackSkills / skillCategories / howlingCategories）は
// `labelKey` という別の名前で持ち、読む側が翻訳する。プロパティ名が違うので、
// 間違えて素で使うとコンパイルエラーになる
preLocalize("characteristics", { keys: ["label"] });
preLocalize("skillGroups", { keys: ["label"] });
preLocalize("baseSkills", { keys: ["label"] });
preLocalize("skills", { keys: ["label"] });
preLocalize("emotionAttributes", { keys: ["label"] });
preLocalize("resonantEmotions", { keys: ["label"] });
preLocalize("initiativePresets", { keys: ["label"] });
// attackSkills は意図的に対象外。labelKey がそのまま武器スキーマの choices に入るため、
// i18nInit で書き換わると「スキーマ定義とi18nInitのどちらが先か」で値が変わってしまう。
// 描画時に formInput の localize が解決する（module/config/attack-skills.ts を参照）
