import { describe, expect, it } from "vitest";
import { formatDMPart, type ModifierSet, NO_MODIFIER, sumModifiers } from "./types";

const mod = (m: Partial<ModifierSet>): ModifierSet => ({ ...NO_MODIFIER, ...m });

describe("sumModifiers", () => {
  it("3つの値をそれぞれ足し合わせる", () => {
    expect(sumModifiers(mod({ bonus: 1, success: 2, target: 3 }), mod({ bonus: 4 }))).toEqual({
      bonus: 5,
      success: 2,
      target: 3,
    });
  });

  it("負の修正で打ち消せる", () => {
    expect(sumModifiers(mod({ target: -2 }), mod({ target: 2 })).target).toBe(0);
  });

  it("何も渡さなければ効かない組を返す", () => {
    expect(sumModifiers()).toEqual({ bonus: 0, success: 0, target: 0 });
  });

  // NO_MODIFIER は Object.freeze されている。畳み先を作り直さずに書き込むと凍った組を壊す
  it("渡した組を書き換えない", () => {
    const original = mod({ bonus: 1 });
    sumModifiers(original, mod({ bonus: 1 }));

    expect(original.bonus).toBe(1);
  });
});

describe("formatDMPart", () => {
  it("修正値がなければ基準値だけを返す", () => {
    expect(formatDMPart(3, 0)).toBe("3");
  });

  it("正の修正値は括弧付きで符号を添える", () => {
    expect(formatDMPart(3, 2)).toBe("(3+2)");
  });

  it("負の修正値は括弧付きでそのまま連結する", () => {
    expect(formatDMPart(3, -2)).toBe("(3-2)");
  });
});
