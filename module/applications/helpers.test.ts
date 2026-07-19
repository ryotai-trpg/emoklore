import { describe, expect, it } from "vitest";
import {
  calculateCharacteristicPoints,
  calculateCharPointSum,
  calculateSkillPoints,
  calculateTotalSkillPoints,
} from "./helpers";
import type { CharacteristicsMap } from "./types";

// CharacteristicsMap は描画用の field も持つが、ポイント計算は value しか見ない。
// テスト側の関心は value だけなので、境界でまとめて1回だけキャストする。
const characteristics = (values: Record<string, number>): CharacteristicsMap =>
  Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, { value }]),
  ) as CharacteristicsMap;

describe("calculateSkillPoints", () => {
  it("技能レベルのコストは 1/5/15", () => {
    expect(calculateSkillPoints([{ level: 1 }])).toBe(1);
    expect(calculateSkillPoints([{ level: 2 }])).toBe(5);
    expect(calculateSkillPoints([{ level: 3 }])).toBe(15);
  });

  it("レベル0の技能はコストに数えない", () => {
    expect(calculateSkillPoints([{ level: 0 }, { level: 0 }])).toBe(0);
  });

  it("同じレベルの技能はレベルごとに合算される", () => {
    expect(calculateSkillPoints([{ level: 1 }, { level: 1 }, { level: 3 }])).toBe(17);
  });

  it("空リストは0", () => {
    expect(calculateSkillPoints([])).toBe(0);
  });
});

describe("calculateTotalSkillPoints", () => {
  it("通常技能とエクストラ技能のコストを足し合わせる", () => {
    expect(calculateTotalSkillPoints([{ level: 2 }], [{ level: 1 }])).toBe(6);
  });

  it("どちらも空なら0", () => {
    expect(calculateTotalSkillPoints([], [])).toBe(0);
  });
});

describe("calculateCharacteristicPoints", () => {
  it("すべての能力値を合計する（運勢を含む）", () => {
    expect(calculateCharacteristicPoints(characteristics({ physical: 3, fortune: 2 }))).toBe(5);
  });
});

describe("calculateCharPointSum", () => {
  it("運勢を除いた能力値の合計を返す", () => {
    expect(calculateCharPointSum(characteristics({ physical: 3, mentality: 4, fortune: 2 }))).toBe(
      7,
    );
  });
});
