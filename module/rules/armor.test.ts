import { describe, expect, it } from "vitest";
import { calculateArmorTotal } from "./armor";

describe("calculateArmorTotal", () => {
  it("防具が無ければ0", () => {
    expect(calculateArmorTotal([])).toBe(0);
  });

  it("装備中の防御力を合算する", () => {
    expect(
      calculateArmorTotal([
        { equipped: true, defense: 2 },
        { equipped: true, defense: 35 },
      ]),
    ).toBe(37);
  });

  it("装備していないものは数えない", () => {
    expect(
      calculateArmorTotal([
        { equipped: false, defense: 10 },
        { equipped: true, defense: 3 },
      ]),
    ).toBe(3);
  });

  it("防御力0が混ざっても変わらない", () => {
    expect(
      calculateArmorTotal([
        { equipped: true, defense: 0 },
        { equipped: true, defense: 5 },
      ]),
    ).toBe(5);
  });
});
