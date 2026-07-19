import { describe, expect, it } from "vitest";
import { resolveSkillRoll } from "./skill-roll";
import type { ModifierSet } from "./types";

const noMod: ModifierSet = { bonus: 0, success: 0, target: 0 };
const mod = (m: Partial<ModifierSet>): ModifierSet => ({ ...noMod, ...m });

describe("resolveSkillRoll", () => {
  it("修正がなければレベルがダイス数、基準値が目標値になる", () => {
    expect(
      resolveSkillRoll({
        level: 2,
        baseTarget: 6,
        skillMod: noMod,
        characteristicMod: noMod,
        skillGroupMod: noMod,
      }),
    ).toEqual({ diceCount: 2, target: 6, successMod: 0, dmFormula: "2DM≦6" });
  });

  it("3系統のボーナスがダイス数に合算される", () => {
    const spec = resolveSkillRoll({
      level: 2,
      baseTarget: 6,
      skillMod: mod({ bonus: 1 }),
      characteristicMod: mod({ bonus: 2 }),
      skillGroupMod: mod({ bonus: 3 }),
    });

    expect(spec.diceCount).toBe(8);
    expect(spec.dmFormula).toBe("(2+6)DM≦6");
  });

  it("3系統の目標値修正が目標値に合算される", () => {
    const spec = resolveSkillRoll({
      level: 2,
      baseTarget: 6,
      skillMod: mod({ target: 1 }),
      characteristicMod: mod({ target: -2 }),
      skillGroupMod: mod({ target: 1 }),
    });

    expect(spec.target).toBe(6);
    expect(spec.dmFormula).toBe("2DM≦6");
  });

  it("3系統の成功数修正が合算される", () => {
    const spec = resolveSkillRoll({
      level: 1,
      baseTarget: 4,
      skillMod: mod({ success: 1 }),
      characteristicMod: mod({ success: 1 }),
      skillGroupMod: mod({ success: -1 }),
    });

    expect(spec.successMod).toBe(1);
  });

  it("負の修正は括弧付きでそのまま式に出る", () => {
    const spec = resolveSkillRoll({
      level: 3,
      baseTarget: 5,
      skillMod: mod({ bonus: -1, target: -2 }),
      characteristicMod: noMod,
      skillGroupMod: noMod,
    });

    expect(spec).toEqual({
      diceCount: 2,
      target: 3,
      successMod: 0,
      dmFormula: "(3-1)DM≦(5-2)",
    });
  });
});
