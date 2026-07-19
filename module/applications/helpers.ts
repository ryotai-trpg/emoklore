import type { ResonantEmotionsConfig } from "../config/resonant-emotions";
/**
 * シートのテンプレートに渡す選択肢やラベルを組み立てる。
 * ルール計算は module/rules/ に、DOM操作は module/utils/sheet.ts にある。
 */

export const createSkillLevelOptions = (): Array<{ value: string; label: string }> => {
  return Object.entries(CONFIG.EMOKLORE.skillLevel).map(([value, { label }]) => ({
    value,
    label,
  }));
};

export const createEmotionOptions = (): Array<{ value: string; label: string; group: string }> => {
  return Object.entries(CONFIG.EMOKLORE.resonantEmotions).map(([value, { label, attribute }]) => ({
    value: String(value),
    label: game.i18n.localize("EMOKLORE.resonantEmotion", {
      emotion: label,
      attribute: game.i18n.localize(`EMOKLORE.emotionAttributes.${String(attribute)}`),
    }),
    group: game.i18n.localize(`EMOKLORE.emotionAttributes.${String(attribute)}`),
  }));
};

/**
 * 共鳴感情に対応する属性の言語キーを引く。
 *
 * 未選択や、既知でない感情が保存されている場合は空文字を返す。以前は
 * `EMOKLORE.emotionAttributes.` という尻切れのキーを組み立てており、
 * それがシートにそのまま表示されていた。
 */
export const getEmotionAttributes = (
  emotions: Record<string, string | undefined>,
  resonantEmotions: Record<string, ResonantEmotionsConfig>,
): Record<string, string> => {
  const emotionAttributes: Record<string, string> = {};

  for (const key of ["surface", "hidden", "root"]) {
    const emotionKey = emotions[key];
    const attribute = emotionKey ? resonantEmotions[emotionKey]?.attribute : undefined;
    emotionAttributes[key] = attribute ? `EMOKLORE.emotionAttributes.${attribute}` : "";
  }

  return emotionAttributes;
};
