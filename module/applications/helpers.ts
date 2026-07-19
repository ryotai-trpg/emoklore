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

export const getEmotionAttributes = (
  emotions: Record<string, string>,
  resonantEmotions: Record<string, any>,
): Record<string, string> => {
  const emotionAttributes: Record<string, string> = {};

  for (const key of ["surface", "hidden", "root"]) {
    const emotionKey = emotions[key];
    const attr = resonantEmotions[emotionKey]?.attribute ?? "";
    emotionAttributes[key] = `EMOKLORE.emotionAttributes.${String(attr)}`;
  }

  return emotionAttributes;
};
