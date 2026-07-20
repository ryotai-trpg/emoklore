import { describe, expect, it } from "vitest";
import {
  calculateBaseSkillTarget,
  calculateInitiative,
  calculateMaxHp,
  calculateMaxMp,
  calculateSkillTarget,
  clampToMax,
  normalizeResonance,
} from "./derived-values";

describe("calculateSkillTarget", () => {
  it("技能レベルと能力値を足す", () => {
    expect(calculateSkillTarget(2, 4)).toBe(6);
  });

  it("未修得（レベル0）なら能力値がそのまま目標値になる", () => {
    expect(calculateSkillTarget(0, 4)).toBe(4);
  });
});

describe("calculateBaseSkillTarget", () => {
  it("能力値がそのまま目標値になる", () => {
    expect(calculateBaseSkillTarget("perception", 4)).toBe(4);
  });

  it("〈手当〉だけは能力値の半分になる", () => {
    expect(calculateBaseSkillTarget("treatment", 4)).toBe(2);
  });

  it("〈手当〉の半分は切り上げる（能力値3なら2）", () => {
    expect(calculateBaseSkillTarget("treatment", 3)).toBe(2);
  });

  it("〈手当〉は能力値1でも1を下回らない", () => {
    expect(calculateBaseSkillTarget("treatment", 1)).toBe(1);
  });
});

describe("calculateMaxHp", () => {
  it("基礎値10に身体を足す", () => {
    expect(calculateMaxHp(3)).toBe(13);
  });
});

describe("calculateMaxMp", () => {
  it("精神と知力を足す", () => {
    expect(calculateMaxMp(3, 4)).toBe(7);
  });
});

describe("normalizeResonance", () => {
  it("0以下は1に丸める", () => {
    expect(normalizeResonance(0)).toBe(1);
    expect(normalizeResonance(-2)).toBe(1);
  });

  it("1以上はそのまま", () => {
    expect(normalizeResonance(3)).toBe(3);
  });
});

describe("calculateInitiative", () => {
  it("身体に〈速度〉の技能レベルを足す", () => {
    expect(calculateInitiative(4, 2)).toBe(6);
  });
});

describe("clampToMax", () => {
  it("現在値が最大値を超えていたら最大値に丸める", () => {
    expect(clampToMax(15, 13)).toBe(13);
  });

  it("最大値以下ならそのまま", () => {
    expect(clampToMax(8, 13)).toBe(8);
  });
});
