// disabled / sort はスキーマ由来で本体JSDocの型に出ないため補強する
type SheetActiveEffect = ActiveEffect & { disabled: boolean; sort: number };

export function prepareActiveEffectCategories(
  effects: Iterable<ActiveEffect>,
): Record<EffectCategory["type"], EffectCategory> {
  // Define effect header categories
  const categories: Record<EffectCategory["type"], EffectCategory> = {
    temporary: {
      type: "temporary" as const,
      label: game.i18n.localize("EMOKLORE.Effect.Temporary"),
      effects: [],
    },
    passive: {
      type: "passive" as const,
      label: game.i18n.localize("EMOKLORE.Effect.Passive"),
      effects: [],
    },
    inactive: {
      type: "inactive" as const,
      label: game.i18n.localize("EMOKLORE.Effect.Inactive"),
      effects: [],
    },
  };

  // Iterate over active effects, classifying them into categories
  for (const e of effects as Iterable<SheetActiveEffect>) {
    if (e.disabled) categories.inactive.effects.push(e);
    else if (e.isTemporary) categories.temporary.effects.push(e);
    else categories.passive.effects.push(e);
  }

  // Sort each category
  for (const c of Object.values(categories)) {
    c.effects.sort((a, b) => (a.sort || 0) - (b.sort || 0));
  }
  return categories;
}

interface EffectCategory {
  type: "temporary" | "passive" | "inactive";
  label: string;
  effects: SheetActiveEffect[];
}
