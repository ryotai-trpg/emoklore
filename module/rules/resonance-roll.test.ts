import { describe, expect, it } from "vitest";
import {
  normalizeIntensity,
  type ResonanceRollParams,
  resolveResonanceRoll,
} from "./resonance-roll";
import { type ModifierSet, NO_MODIFIER } from "./types";

const mod = (m: Partial<ModifierSet>): ModifierSet => ({ ...NO_MODIFIER, ...m });

/** 修正を見ないテストが大半なので、既定で効かない組を埋める */
const params = (
  p: Partial<ResonanceRollParams> & Pick<ResonanceRollParams, "resonanceValue" | "intensity">,
): ResonanceRollParams => ({ mod: NO_MODIFIER, ...p });

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
    expect(
      resolveResonanceRoll(params({ resonanceValue: 3, intensity: 4, emotionMatch: "none" })),
    ).toEqual({
      diceCount: 3,
      target: 4,
      successMod: 0,
      dmFormula: "3DM≦4",
    });
  });

  it("emotionMatch未指定は一致なしと同じ", () => {
    expect(resolveResonanceRoll(params({ resonanceValue: 3, intensity: 4 })).diceCount).toBe(3);
  });

  it("ルーツ属性一致で+1", () => {
    const spec = resolveResonanceRoll(
      params({ resonanceValue: 3, intensity: 4, emotionMatch: "root" }),
    );
    expect(spec.diceCount).toBe(4);
    expect(spec.dmFormula).toBe("4DM≦4");
  });

  it("完全一致で2倍", () => {
    const spec = resolveResonanceRoll(
      params({ resonanceValue: 3, intensity: 4, emotionMatch: "completely" }),
    );
    expect(spec.diceCount).toBe(6);
    expect(spec.dmFormula).toBe("6DM≦4");
  });

  it("修正がなければ成功数修正は0のまま", () => {
    expect(
      resolveResonanceRoll(params({ resonanceValue: 9, intensity: 1, emotionMatch: "completely" }))
        .successMod,
    ).toBe(0);
  });

  // 倍率はレベルに掛かるもので、ボーナスは判定に足すもの。掛ける相手にボーナスを
  // 混ぜると、共鳴値3・ボーナス1・完全一致が 7 ではなく 8 になる
  it("完全一致の倍化はダイスボーナスより先に効く", () => {
    const spec = resolveResonanceRoll(
      params({
        resonanceValue: 3,
        intensity: 4,
        emotionMatch: "completely",
        mod: mod({ bonus: 1 }),
      }),
    );

    expect(spec.diceCount).toBe(7);
    expect(spec.dmFormula).toBe("(6+1)DM≦4");
  });

  it("判定値修正と成功数修正も式と結果に乗る", () => {
    const spec = resolveResonanceRoll(
      params({ resonanceValue: 3, intensity: 4, mod: mod({ target: -2, success: 1 }) }),
    );

    expect(spec).toEqual({
      diceCount: 3,
      target: 2,
      successMod: 1,
      dmFormula: "3DM≦(4-2)",
    });
  });
});
