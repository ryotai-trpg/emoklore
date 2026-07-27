import { describe, expect, it } from "vitest";
import { buildKaiAttackSpec, canRollKaiDamage, substituteSuccess } from "./kai-attack";

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

describe("canRollKaiDamage", () => {
  const judged = { judgeless: false, damageFormula: "@successd4+3" };
  const judgeless = { judgeless: true, damageFormula: "1d6" };

  it("判定ありは命中していれば振れる", () => {
    expect(canRollKaiDamage({ ...judged, successCount: 1 })).toBe(true);
    expect(canRollKaiDamage({ ...judged, successCount: 3 })).toBe(true);
  });

  it("判定ありで成功数0以下なら振れない", () => {
    expect(canRollKaiDamage({ ...judged, successCount: 0 })).toBe(false);
    expect(canRollKaiDamage({ ...judged, successCount: -1 })).toBe(false);
  });

  it("判定をまだ振っていなければ振れない", () => {
    expect(canRollKaiDamage({ ...judged, successCount: null })).toBe(false);
  });

  // 判定なしには「外れる」概念が無い。固定成功数0の攻撃を命中の条件で塞ぐと、
  // ボタンが1つも出ないカードになる
  it("判定なしは固定成功数0でも振れる", () => {
    expect(canRollKaiDamage({ ...judgeless, successCount: 0 })).toBe(true);
  });

  it("ダメージ式が空なら振れない", () => {
    expect(canRollKaiDamage({ judgeless: false, damageFormula: "", successCount: 3 })).toBe(false);
    expect(canRollKaiDamage({ judgeless: true, damageFormula: "", successCount: 3 })).toBe(false);
  });
});
