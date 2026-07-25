// disabled / sort はスキーマ由来で本体JSDocの型に出ないため補強する
type SheetActiveEffect = ActiveEffect & { disabled: boolean; sort: number };

export function prepareActiveEffectCategories(
  effects: Iterable<ActiveEffect>,
): Record<EffectCategory["type"], EffectCategory> {
  const categories: Record<EffectCategory["type"], EffectCategory> = {
    temporary: {
      type: "temporary" as const,
      label: _loc("EMOKLORE.Effect.Temporary"),
      effects: [],
    },
    passive: {
      type: "passive" as const,
      label: _loc("EMOKLORE.Effect.Passive"),
      effects: [],
    },
    inactive: {
      type: "inactive" as const,
      label: _loc("EMOKLORE.Effect.Inactive"),
      effects: [],
    },
  };

  // 無効なものを優先し、残りを一時的／恒常に振り分ける。
  //
  // 本体の `isSuppressed` は `duration.expired` を拾うので、期限切れの効果は
  // `active` が落ちる。ただしここが見ているのは `disabled`（利用者が切ったか）なので、
  // 期限切れは「無効」ではなく一時的／恒常のどちらかに残る。区分は
  // 「利用者が切ったか」であって「いま効いているか」ではない
  for (const e of effects as Iterable<SheetActiveEffect>) {
    if (e.disabled) categories.inactive.effects.push(e);
    else if (e.isTemporary) categories.temporary.effects.push(e);
    else categories.passive.effects.push(e);
  }

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
