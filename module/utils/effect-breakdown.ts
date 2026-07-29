/**
 * 効果による修正の、技能1行への帰属。
 *
 * `mod.*` は保存されず（`persisted: false`）Active Effect以外から書かれないため、
 * modの値そのものが「効果による差分」になる。ここはその差分を「どの効果が、いくら
 * 寄与したか」に分解するための突き合わせを持つ。changeの値の数値化（Roll評価）は
 * Foundry APIが要るので `applications/context/skill-mods.ts` が行う。
 *
 * `CONFIG` を読まないので単体テストできる。
 */

import {
  composeTargetId,
  MODIFIER_ASPECTS,
  type ModifierAspect,
  type ModifierTarget,
} from "./effect-keys";

/** 効果のchange 1件を、行への寄与として読み替えたもの */
export type AttributedChange = {
  target: ModifierTarget;
  aspect: ModifierAspect;
  /** 数値化できた寄与。add は正、subtract は負。他の type と評価失敗は null（帰属不能） */
  amount: number | null;
  effectName: string;
};

/**
 * 技能1行に効く適用先の一覧。
 *
 * 判定の合算（`resolveSkillRoll`）と同じ4系統 — 自分の表エントリ・参照能力値・
 * 技能グループ・全体。グループに属さない技能は `group` を `""` で渡す
 * （`#toRollParams` がグループ修正の代わりに効かない組を使うのと同じ扱い）。
 */
export const resolveRowScopes = (
  own: ModifierTarget,
  characteristic: string,
  group: string,
): ModifierTarget[] => {
  const scopes: ModifierTarget[] = [
    own,
    { kind: "collection", collection: "characteristics", key: characteristic },
  ];
  if (group) scopes.push({ kind: "collection", collection: "skillGroups", key: group });
  scopes.push({ kind: "global" });
  return scopes;
};

export type AttributionResult = {
  /** この行に効いているchange（適用先が範囲内のもの） */
  entries: AttributedChange[];
  /**
   * 修正先ごとに、金額を出してよいか。数値化できた寄与の合計が実測の差分と一致する
   * ときだけ true。falseの修正先は効果名だけを出す — ツールチップがセルの値と
   * 矛盾する数字を出さないための下限で、override / multiply が混ざると倒れる
   */
  amountShown: Record<ModifierAspect, boolean>;
};

/** 行の範囲に載るchangeを拾い、修正先ごとに実測の差分と突き合わせる */
export const attributeRowModifiers = (
  changes: AttributedChange[],
  scopes: ModifierTarget[],
  totals: Record<ModifierAspect, number>,
): AttributionResult => {
  const scopeIds = new Set(scopes.map(composeTargetId));
  const entries = changes.filter((change) => scopeIds.has(composeTargetId(change.target)));

  const amountShown = Object.fromEntries(
    MODIFIER_ASPECTS.map((aspect) => {
      let sum: number | null = 0;
      for (const entry of entries) {
        if (entry.aspect !== aspect) continue;
        sum = sum === null || entry.amount === null ? null : sum + entry.amount;
      }
      return [aspect, sum !== null && sum === totals[aspect]];
    }),
  ) as Record<ModifierAspect, boolean>;

  return { entries, amountShown };
};
