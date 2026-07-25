import { describe, expect, it } from "vitest";
import { buildKaiAttackSpec, substituteSuccess } from "./kai-attack";

describe("buildKaiAttackSpec", () => {
  it("ダイス数と判定値をそのまま RollSpec に組む", () => {
    expect(buildKaiAttackSpec({ diceCount: 2, target: 7 })).toEqual({
      diceCount: 2,
      target: 7,
      successMod: 0,
      dmFormula: "2DM≦7",
    });
  });

  it("修正の系統を持たないので successMod は常に0", () => {
    expect(buildKaiAttackSpec({ diceCount: 5, target: 10 }).successMod).toBe(0);
  });
});

describe("substituteSuccess", () => {
  it("@success を成功数に差し替える（グルーが効く）", () => {
    expect(substituteSuccess("@successd3+3", 3)).toBe("3d3+3");
    expect(substituteSuccess("@successd4+3", 2)).toBe("2d4+3");
  });

  it("大文字小文字を問わない", () => {
    expect(substituteSuccess("@SuccessD4", 3)).toBe("3D4");
  });

  it("@success を含まない固定式はそのまま返す", () => {
    expect(substituteSuccess("1+1d6", 5)).toBe("1+1d6");
  });

  it("複数の @success をすべて差し替える", () => {
    expect(substituteSuccess("@successd6+@success", 4)).toBe("4d6+4");
  });
});
