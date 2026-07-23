import { describe, expect, it } from "vitest";
import { resolveHpBoundary, resolveMpBoundary } from "./resource-boundary";

describe("resolveHpBoundary", () => {
  it("0まで落ちたら【心肺停止】", () => {
    expect(resolveHpBoundary({ before: 11, after: 0 })).toBe("cardiacArrest");
  });

  it("半分以上を失っていても、0なら心肺停止が優先", () => {
    expect(resolveHpBoundary({ before: 4, after: 0 })).toBe("cardiacArrest");
  });

  it("一度に現在HPの半分以上を失うと気絶判定（ちょうど半分を含む）", () => {
    expect(resolveHpBoundary({ before: 10, after: 5 })).toBe("unconsciousCheck");
    expect(resolveHpBoundary({ before: 10, after: 4 })).toBe("unconsciousCheck");
    expect(resolveHpBoundary({ before: 3, after: 1 })).toBe("unconsciousCheck");
  });

  it("半分未満なら案内しない", () => {
    expect(resolveHpBoundary({ before: 10, after: 6 })).toBe(null);
    expect(resolveHpBoundary({ before: 10, after: 10 })).toBe(null);
  });

  it("既に0の対象への追撃は境界をまたがない", () => {
    expect(resolveHpBoundary({ before: 0, after: 0 })).toBe(null);
  });
});

describe("resolveMpBoundary", () => {
  it("0以下にまたいだら〈＊自我〉判定の案内", () => {
    expect(resolveMpBoundary({ before: 2, after: 0 })).toBe("faintCheck");
    expect(resolveMpBoundary({ before: 1, after: -1 })).toBe("faintCheck");
  });

  it("0のまま・0未満のままの変化では出さない", () => {
    expect(resolveMpBoundary({ before: 0, after: 0 })).toBe(null);
    expect(resolveMpBoundary({ before: 0, after: -2 })).toBe(null);
  });

  it("増えるときは出さない", () => {
    expect(resolveMpBoundary({ before: 0, after: 3 })).toBe(null);
    expect(resolveMpBoundary({ before: 2, after: 3 })).toBe(null);
  });
});
