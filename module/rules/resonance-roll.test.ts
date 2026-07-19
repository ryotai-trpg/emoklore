import { describe, expect, it } from "vitest";
import { normalizeIntensity, resolveResonanceRoll } from "./resonance-roll";

describe("normalizeIntensity", () => {
  it("正の数はそのまま", () => {
    expect(normalizeIntensity(5)).toBe(5);
  });

  it("0以下は1に丸める", () => {
    expect(normalizeIntensity(0)).toBe(1);
    expect(normalizeIntensity(-3)).toBe(1);
  });

  it("NaNは1に丸める（未入力のinputがNaNになる）", () => {
    expect(normalizeIntensity(Number.NaN)).toBe(1);
  });
});

describe("resolveResonanceRoll", () => {
  it("一致なしなら共鳴値がそのままダイス数になる", () => {
    expect(resolveResonanceRoll({ resonanceValue: 3, intensity: 4, emotionMatch: "none" })).toEqual(
      {
        diceCount: 3,
        target: 4,
        successMod: 0,
        dmFormula: "3DM≦4",
      },
    );
  });

  it("emotionMatch未指定は一致なしと同じ", () => {
    expect(resolveResonanceRoll({ resonanceValue: 3, intensity: 4 }).diceCount).toBe(3);
  });

  it("ルーツ属性一致で+1", () => {
    const spec = resolveResonanceRoll({ resonanceValue: 3, intensity: 4, emotionMatch: "root" });
    expect(spec.diceCount).toBe(4);
    expect(spec.dmFormula).toBe("4DM≦4");
  });

  it("完全一致で2倍", () => {
    const spec = resolveResonanceRoll({
      resonanceValue: 3,
      intensity: 4,
      emotionMatch: "completely",
    });
    expect(spec.diceCount).toBe(6);
    expect(spec.dmFormula).toBe("6DM≦4");
  });

  it("成功数修正は常に0", () => {
    expect(
      resolveResonanceRoll({ resonanceValue: 9, intensity: 1, emotionMatch: "completely" })
        .successMod,
    ).toBe(0);
  });
});
