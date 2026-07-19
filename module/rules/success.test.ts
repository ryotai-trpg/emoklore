import { describe, expect, it } from "vitest";
import { classifyFace, facePoints, resolveResultName } from "./success";

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
