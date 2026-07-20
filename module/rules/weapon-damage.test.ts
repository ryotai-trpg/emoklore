import { describe, expect, it } from "vitest";
import { buildDamageFormula, canRollDamage } from "./weapon-damage";

describe("canRollDamage", () => {
  it("成功数が1以上なら振れる", () => {
    expect(canRollDamage(1)).toBe(true);
    expect(canRollDamage(5)).toBe(true);
  });

  it("失敗とファンブルでは振れない", () => {
    expect(canRollDamage(0)).toBe(false);
    expect(canRollDamage(-2)).toBe(false);
  });
});

describe("buildDamageFormula", () => {
  it("近接は成功数ぶんのD3に武器攻撃力を足す", () => {
    expect(buildDamageFormula({ successCount: 2, damageDie: "d3", attackPower: "1D3" })).toBe(
      "2d3 + 1D3",
    );
  });

  it("奥義はD6になる", () => {
    expect(buildDamageFormula({ successCount: 3, damageDie: "d6", attackPower: "1D6" })).toBe(
      "3d6 + 1D6",
    );
  });

  it("遠隔はダイスを振らず成功数がそのままダメージになる", () => {
    expect(buildDamageFormula({ successCount: 4, damageDie: null, attackPower: "2D6" })).toBe(
      "4 + 2D6",
    );
  });

  it("武器攻撃力が固定値でもよい", () => {
    expect(buildDamageFormula({ successCount: 2, damageDie: "d3", attackPower: "2" })).toBe(
      "2d3 + 2",
    );
  });

  it("武器攻撃力が空なら加算しない", () => {
    expect(buildDamageFormula({ successCount: 3, damageDie: "d3", attackPower: "" })).toBe("3d3");
    expect(buildDamageFormula({ successCount: 3, damageDie: null, attackPower: "" })).toBe("3");
  });

  it("加算値を渡すと末尾に足される（〈ストレングス〉の接続点）", () => {
    expect(
      buildDamageFormula({ successCount: 2, damageDie: "d3", attackPower: "1D3", bonus: 2 }),
    ).toBe("2d3 + 1D3 + 2");
  });

  it("加算値が負なら減算になる", () => {
    expect(
      buildDamageFormula({ successCount: 2, damageDie: "d3", attackPower: "1D3", bonus: -1 }),
    ).toBe("2d3 + 1D3 - 1");
  });

  it("加算値が0なら項を足さない", () => {
    expect(
      buildDamageFormula({ successCount: 2, damageDie: "d3", attackPower: "", bonus: 0 }),
    ).toBe("2d3");
  });

  it("命中していない成功数では組み立てられない", () => {
    expect(() => buildDamageFormula({ successCount: 0, damageDie: "d3", attackPower: "" })).toThrow(
      /成功数ではない/,
    );
    expect(() =>
      buildDamageFormula({ successCount: -1, damageDie: "d3", attackPower: "" }),
    ).toThrow(/成功数ではない/);
  });
});
