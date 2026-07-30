import { describe, expect, it } from "vitest";
import { type AttributedChange, attributeRowModifiers, resolveRowScopes } from "./effect-breakdown";
import type { ModifierTarget } from "./effect-keys";

const own: ModifierTarget = { kind: "collection", collection: "skills", key: "search" };

const change = (
  target: ModifierTarget,
  aspect: AttributedChange["aspect"],
  amount: number | null,
  effectName = "効果",
): AttributedChange => ({ target, aspect, amount, effectName });

describe("resolveRowScopes", () => {
  it("自分・能力値・グループ・全体の4系統を並べる", () => {
    const scopes = resolveRowScopes(own, "intelligence", "investigation");
    expect(scopes).toEqual([
      own,
      { kind: "collection", collection: "characteristics", key: "intelligence" },
      { kind: "collection", collection: "skillGroups", key: "investigation" },
      { kind: "global" },
    ]);
  });

  it("グループに属さない技能はグループの系統を持たない", () => {
    const scopes = resolveRowScopes(own, "intelligence", "");
    expect(scopes).toHaveLength(3);
    expect(scopes.some((s) => s.kind === "collection" && s.collection === "skillGroups")).toBe(
      false,
    );
  });

  it("カスタム技能はアイテムidをキーにした自分の系統を持つ", () => {
    const custom: ModifierTarget = { kind: "collection", collection: "customSkills", key: "a1B2" };
    expect(resolveRowScopes(custom, "physical", "")[0]).toEqual(custom);
  });
});

describe("attributeRowModifiers", () => {
  const scopes = resolveRowScopes(own, "intelligence", "investigation");

  it("範囲内のchangeだけを拾う", () => {
    const other: ModifierTarget = { kind: "collection", collection: "skills", key: "insight" };
    const { entries } = attributeRowModifiers(
      [
        change(own, "target", 2),
        change({ kind: "global" }, "bonus", 1),
        change(other, "target", 9),
        change({ kind: "collection", collection: "characteristics", key: "physical" }, "target", 9),
      ],
      scopes,
      { bonus: 1, target: 2, success: 0 },
    );
    expect(entries).toHaveLength(2);
  });

  it("寄与の合計が実測と一致する修正先だけ金額を出す", () => {
    const { amountShown } = attributeRowModifiers(
      [change(own, "target", 2), change({ kind: "global" }, "target", -1)],
      scopes,
      { bonus: 0, target: 1, success: 0 },
    );
    expect(amountShown.target).toBe(true);
  });

  it("数値化できないchangeが混ざった修正先は金額を出さない", () => {
    const { entries, amountShown } = attributeRowModifiers(
      [change(own, "target", 2), change({ kind: "global" }, "target", null)],
      scopes,
      { bonus: 0, target: 5, success: 0 },
    );
    expect(entries).toHaveLength(2);
    expect(amountShown.target).toBe(false);
  });

  it("合計が実測とずれる修正先は金額を出さない", () => {
    // final段階の生キー上書きなど、changeに現れない要因で実測が動いた場合
    const { amountShown } = attributeRowModifiers([change(own, "target", 2)], scopes, {
      bonus: 0,
      target: 3,
      success: 0,
    });
    expect(amountShown.target).toBe(false);
  });

  it("修正先ごとに独立に判定する", () => {
    const { amountShown } = attributeRowModifiers(
      [change(own, "bonus", 1), change(own, "success", null)],
      scopes,
      { bonus: 1, target: 0, success: 2 },
    );
    expect(amountShown.bonus).toBe(true);
    expect(amountShown.success).toBe(false);
    // changeの無い修正先は実測0となら一致する（出すものが無いだけ）
    expect(amountShown.target).toBe(true);
  });
});
