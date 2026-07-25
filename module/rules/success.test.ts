import { describe, expect, it } from "vitest";
import {
  classifyFace,
  facePoints,
  meetsRequirement,
  requiredSuccesses,
  resolveResultName,
} from "./success";

describe("classifyFace", () => {
  it.each([
    [1, "critical"],
    [2, "success"],
    [5, "success"],
    [6, "failure"],
    [9, "failure"],
    [10, "fumble"],
  ])("目標値5のとき出目%iは%s", (face, expected) => {
    expect(classifyFace(face, 5)).toBe(expected);
  });

  it("目標値が10以上でも出目10はファンブル", () => {
    expect(classifyFace(10, 10)).toBe("fumble");
  });

  it("目標値が0以下でも出目1はクリティカル", () => {
    expect(classifyFace(1, 0)).toBe("critical");
  });
});

describe("facePoints", () => {
  it.each([
    ["critical", 2],
    ["success", 1],
    ["failure", 0],
    ["fumble", -1],
  ] as const)("%sは成功数%i", (outcome, expected) => {
    expect(facePoints(outcome)).toBe(expected);
  });
});

describe("resolveResultName", () => {
  it.each([
    [-2, "fumble"],
    [-1, "fumble"],
    [0, "failure"],
    [1, "single"],
    [2, "double"],
    [3, "triple"],
    [4, "miracle"],
    [9, "miracle"],
    [10, "catastrophe"],
    [15, "catastrophe"],
  ])("成功数%iは%s", (successCount, expected) => {
    expect(resolveResultName(successCount)).toBe(expected);
  });
});

describe("requiredSuccesses", () => {
  it.each([
    ["single", 1],
    ["double", 2],
    ["triple", 3],
    ["miracle", 4],
  ] as const)("%s に要る成功数は%i", (requirement, expected) => {
    expect(requiredSuccesses(requirement)).toBe(expected);
  });
});

describe("meetsRequirement", () => {
  it("要求ちょうどでも届いたことにする", () => {
    expect(meetsRequirement(2, 2)).toBe(true);
  });

  it("足りなければ未達", () => {
    expect(meetsRequirement(1, 2)).toBe(false);
  });

  // 結果名で比べると resolveResultName が4〜9を miracle に潰すので、
  // カタストロフ（10以上）がミラクル要求を満たさなくなる
  it("カタストロフはミラクル要求を満たす", () => {
    expect(meetsRequirement(10, requiredSuccesses("miracle"))).toBe(true);
  });

  it("ファンブル（負の成功数）はどの要求も満たさない", () => {
    expect(meetsRequirement(-1, requiredSuccesses("single"))).toBe(false);
  });
});
