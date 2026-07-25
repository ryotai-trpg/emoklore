import { describe, expect, it } from "vitest";
import { resolveSkillRoll, type SkillRollParams } from "./skill-roll";
import type { ModifierSet } from "./types";

const noMod: ModifierSet = { bonus: 0, success: 0, target: 0 };
const mod = (m: Partial<ModifierSet>): ModifierSet => ({ ...noMod, ...m });

/**
 * 修正の系統は5つあるが、1件のテストが見たいのはたいてい1〜2系統だけ。
 * 残りを既定で埋めて、注目している修正だけがテストの本文に出るようにする。
 */
const params = (
  p: Partial<SkillRollParams> & Pick<SkillRollParams, "level" | "baseTarget">,
): SkillRollParams => ({
  skillMod: noMod,
  characteristicMod: noMod,
  skillGroupMod: noMod,
  globalMod: noMod,
  situationalMod: noMod,
  ...p,
});

describe("resolveSkillRoll", () => {
  it("修正がなければレベルがダイス数、基準値が目標値になる", () => {
    expect(resolveSkillRoll(params({ level: 2, baseTarget: 6 }))).toEqual({
      diceCount: 2,
      target: 6,
      successMod: 0,
      dmFormula: "2DM≦6",
    });
  });

  it("4系統のボーナスがダイス数に合算される", () => {
    const spec = resolveSkillRoll(
      params({
        level: 2,
        baseTarget: 6,
        skillMod: mod({ bonus: 1 }),
        characteristicMod: mod({ bonus: 2 }),
        skillGroupMod: mod({ bonus: 3 }),
        globalMod: mod({ bonus: 1 }),
      }),
    );

    expect(spec.diceCount).toBe(9);
    expect(spec.dmFormula).toBe("(2+7)DM≦6");
  });

  it("4系統の目標値修正が目標値に合算される", () => {
    const spec = resolveSkillRoll(
      params({
        level: 2,
        baseTarget: 6,
        skillMod: mod({ target: 1 }),
        characteristicMod: mod({ target: -2 }),
        skillGroupMod: mod({ target: 1 }),
        globalMod: mod({ target: 1 }),
      }),
    );

    expect(spec.target).toBe(7);
    expect(spec.dmFormula).toBe("2DM≦(6+1)");
  });

  it("4系統の成功数修正が合算される", () => {
    const spec = resolveSkillRoll(
      params({
        level: 1,
        baseTarget: 4,
        skillMod: mod({ success: 1 }),
        characteristicMod: mod({ success: 1 }),
        skillGroupMod: mod({ success: -1 }),
        globalMod: mod({ success: -1 }),
      }),
    );

    expect(spec.successMod).toBe(0);
  });

  // 「全ての技能は判定値-2される」。技能でも能力値でも技能グループでも
  // 切り分けられないので、全体修正だけが受け取れる
  it("全体修正だけでも判定に効く", () => {
    const spec = resolveSkillRoll(
      params({ level: 2, baseTarget: 6, globalMod: mod({ target: -2 }) }),
    );

    expect(spec.target).toBe(4);
    expect(spec.dmFormula).toBe("2DM≦(6-2)");
  });

  it("負の修正は括弧付きでそのまま式に出る", () => {
    const spec = resolveSkillRoll(
      params({ level: 3, baseTarget: 5, skillMod: mod({ bonus: -1, target: -2 }) }),
    );

    expect(spec).toEqual({
      diceCount: 2,
      target: 3,
      successMod: 0,
      dmFormula: "(3-1)DM≦(5-2)",
    });
  });

  // その場の修正はアクターに保存された4系統と同じ扱いで畳む。ダイスボーナスも
  // 成功数修正も判定値修正も、式の内訳にそのまま出る
  it("その場の修正が保存された修正と同じように合算される", () => {
    const spec = resolveSkillRoll(
      params({
        level: 2,
        baseTarget: 6,
        globalMod: mod({ bonus: 1 }),
        situationalMod: mod({ bonus: 2, success: 1, target: -1 }),
      }),
    );

    expect(spec).toEqual({
      diceCount: 5,
      target: 5,
      successMod: 1,
      dmFormula: "(2+3)DM≦(6-1)",
    });
  });
});
