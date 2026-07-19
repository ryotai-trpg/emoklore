import { describe, expect, it } from "vitest";
import { countSuccesses, resolveResultName } from "./success";

describe("countSuccesses", () => {
  it("目標値以下の出目が成功になる", () => {
    expect(countSuccesses([3, 5, 7], 5)).toBe(2);
  });

  it("目標値を超えた出目は数えない", () => {
    expect(countSuccesses([7, 8, 9], 5)).toBe(0);
  });

  it("出目1はクリティカルとして2カウントされる", () => {
    expect(countSuccesses([1], 5)).toBe(2);
  });

  it("出目10はファンブルとして1減算される", () => {
    expect(countSuccesses([10], 5)).toBe(-1);
  });

  it("クリティカルとファンブルは相殺する", () => {
    expect(countSuccesses([1, 10], 5)).toBe(1);
  });

  it("目標値が10のときは出目10が成功と減算の両方に数えられて相殺する", () => {
    // EmokloreRoll の target 既定値が10のため実際に起きうる
    expect(countSuccesses([10], 10)).toBe(0);
  });

  it("目標値が0なら出目1はクリティカル分のみ数える", () => {
    expect(countSuccesses([1], 0)).toBe(1);
  });

  it("ダイスがなければ0", () => {
    expect(countSuccesses([], 5)).toBe(0);
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
