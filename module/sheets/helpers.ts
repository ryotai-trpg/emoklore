import type { SkillRow, CharacteristicsMap } from "./types";

// Helper functions for type-safe operations
export const getSkillPointCosts = (): Record<number, number> => ({
  1: 1,
  2: 5,
  3: 15,
});

export const calculateSkillPoints = (skillList: Array<{ level: number }>): number => {
  const costs = getSkillPointCosts();
  return Object.entries(costs).reduce((sum, [level, cost]) => {
    const count = skillList.filter((skill) => skill.level === parseInt(level)).length;
    return sum + count * cost;
  }, 0);
};

export const calculateTotalSkillPoints = (
  skills: Array<{ level: number; isExtra?: boolean }>,
  exSkills: Array<{ level: number; isExtra?: boolean }>,
): number => {
  return calculateSkillPoints(skills) + calculateSkillPoints(exSkills);
};

export const calculateCharacteristicPoints = (characteristics: CharacteristicsMap): number => {
  return Object.values(characteristics).reduce((sum, obj) => {
    return sum + obj.value;
  }, 0);
};

export const calculateCharPointSum = (characteristics: CharacteristicsMap): number => {
  return calculateCharacteristicPoints(characteristics) - characteristics.fortune.value;
};

export const createSkillLevelOptions = (): Array<{ value: string; label: string }> => {
  return Object.entries(CONFIG.EMOKLORE.skillLevel).map(([value, { label }]) => ({
    value,
    label,
  }));
};

export const createEmotionOptions = (): Array<{ value: string; label: string; group: string }> => {
  return Object.entries(CONFIG.EMOKLORE.resonantEmotions).map(([value, { label, attribute }]) => ({
    value: String(value),
    label: game.i18n.format("EMOKLORE.resonantEmotion", {
      emotion: label,
      attribute: game.i18n.format(`EMOKLORE.emotionAttributes.${String(attribute)}`),
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

export const getEmbeddedDocument = (target: HTMLElement, actor: any): any => {
  const docRow = target.closest("li[data-document-class]") as HTMLElement & {
    dataset: DOMStringMap;
  };

  if (docRow.dataset.documentClass === "Item") {
    return actor.items.get(docRow.dataset.itemId!);
  } else if (docRow.dataset.documentClass === "ActiveEffect") {
    const parent =
      docRow.dataset.parentId === actor.id ? actor : actor.items.get(docRow?.dataset.parentId!);
    return parent?.effects.get(docRow?.dataset.effectId!);
  } else {
    console.warn("Could not find document class");
    return null;
  }
};

export const createDocumentData = (
  target: HTMLElement & { dataset: DOMStringMap },
  actor: any,
): Record<string, any> => {
  const docCls = getDocumentClass(target.dataset.documentClass! as any) as any;

  const docData: Record<string, any> = {
    name: docCls.defaultName({
      type: target.dataset.type,
      parent: actor,
    }),
  };

  // Loop through the dataset and add it to our docData
  for (const [dataKey, value] of Object.entries(target.dataset)) {
    // These data attributes are reserved for the action handling
    if (["action", "documentClass"].includes(dataKey)) continue;
    // Nested properties require dot notation in the HTML, e.g. anything with `system`
    // An example exists in spells.hbs, with `data-system.spell-level`
    // which turns into the dataKey 'system.spellLevel'
    foundry.utils.setProperty(docData, dataKey, value);
  }

  return docData;
};
