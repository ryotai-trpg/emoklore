import { describe, expect, it } from "vitest";
import {
  buildDamageFormula,
  calculateAppliedDamage,
  canRollDamage,
  normalizeReduction,
  resolveStrengthBonus,
} from "./weapon-damage";

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

describe("resolveStrengthBonus", () => {
  it("近接なら技能レベルがそのまま加算値になる", () => {
    expect(resolveStrengthBonus("melee", 2)).toBe(2);
  });

  it("未修得（レベル0）なら加算しない", () => {
    expect(resolveStrengthBonus("melee", 0)).toBe(0);
  });

  it("遠隔には乗らない", () => {
    expect(resolveStrengthBonus("ranged", 3)).toBe(0);
  });

  it("ダメージ式の末尾に内訳として現れる", () => {
    expect(
      buildDamageFormula({
        successCount: 2,
        damageDie: "d3",
        attackPower: "1D6",
        bonus: resolveStrengthBonus("melee", 2),
      }),
    ).toBe("2d3 + 1D6 + 2");
  });
});

describe("normalizeReduction", () => {
  it("0以上の整数はそのまま", () => {
    expect(normalizeReduction(0)).toBe(0);
    expect(normalizeReduction(3)).toBe(3);
  });

  it("負値は0に倒す（ファンブルの成功数を流し込んでも増えない）", () => {
    expect(normalizeReduction(-1)).toBe(0);
  });

  it("小数は切り捨てる", () => {
    expect(normalizeReduction(2.7)).toBe(2);
  });

  it("数値でない入力は0として扱う", () => {
    expect(normalizeReduction(Number.NaN)).toBe(0);
    expect(normalizeReduction(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("calculateAppliedDamage", () => {
  it("軽減も防具も無ければ素通し", () => {
    expect(calculateAppliedDamage({ amount: 7 })).toBe(7);
  });

  it("軽減だけを引く", () => {
    expect(calculateAppliedDamage({ amount: 7, reduction: 2 })).toBe(5);
  });

  it("防具だけを引く。装甲がダメージを上回れば0で止まる", () => {
    expect(calculateAppliedDamage({ amount: 7, armor: 2 })).toBe(5);
    expect(calculateAppliedDamage({ amount: 7, armor: 35 })).toBe(0);
  });

  it("軽減と防具は併用できる", () => {
    expect(calculateAppliedDamage({ amount: 10, reduction: 2, armor: 3 })).toBe(5);
  });

  it("マイナスにはならない", () => {
    expect(calculateAppliedDamage({ amount: 1, reduction: 5, armor: 5 })).toBe(0);
  });
});
