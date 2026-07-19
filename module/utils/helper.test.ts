import { describe, expect, it } from "vitest";
import { formatDMPart } from "./helper";

describe("formatDMPart", () => {
  it("修正値がなければ基準値だけを返す", () => {
    expect(formatDMPart(3, 0)).toBe("3");
  });

  it("正の修正値は括弧付きで符号を添える", () => {
    expect(formatDMPart(3, 2)).toBe("(3+2)");
  });

  it("負の修正値は括弧付きでそのまま連結する", () => {
    expect(formatDMPart(3, -2)).toBe("(3-2)");
  });
});
