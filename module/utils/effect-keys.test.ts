import { describe, expect, it } from "vitest";
import {
  composeModifierKey,
  composeTargetId,
  type ModifierChangeKey,
  parseModifierKey,
  parseTargetId,
} from "./effect-keys";

describe("composeModifierKey", () => {
  it("全体修正は表を挟まない", () => {
    expect(composeModifierKey({ target: { kind: "global" }, aspect: "target" })).toBe(
      "system.mod.target",
    );
  });

  it("表に属する修正は表とキーを挟む", () => {
    expect(
      composeModifierKey({
        target: { kind: "collection", collection: "characteristics", key: "mentality" },
        aspect: "bonus",
      }),
    ).toBe("system.characteristics.mentality.mod.bonus");
  });
});

describe("parseModifierKey", () => {
  const cases: [string, ModifierChangeKey][] = [
    ["system.mod.bonus", { target: { kind: "global" }, aspect: "bonus" }],
    [
      "system.characteristics.physical.mod.success",
      {
        target: { kind: "collection", collection: "characteristics", key: "physical" },
        aspect: "success",
      },
    ],
    [
      "system.skillGroups.negotiations.mod.success",
      {
        target: { kind: "collection", collection: "skillGroups", key: "negotiations" },
        aspect: "success",
      },
    ],
    [
      "system.skills.keenObservation.mod.target",
      {
        target: { kind: "collection", collection: "skills", key: "keenObservation" },
        aspect: "target",
      },
    ],
    [
      "system.baseSkills.investigation.mod.bonus",
      {
        target: { kind: "collection", collection: "baseSkills", key: "investigation" },
        aspect: "bonus",
      },
    ],
  ];

  for (const [key, expected] of cases) {
    it(`${key} を読み取る`, () => {
      expect(parseModifierKey(key)).toEqual(expected);
    });
  }

  it("組み立てたキーは読み戻せる", () => {
    for (const [key, parsed] of cases) {
      expect(composeModifierKey(parsed)).toBe(key);
    }
  });

  // null は「選択式では扱えない」の合図。シートはこれを見て生の入力に倒すので、
  // ここで弾いたキーも効果としては有効なまま編集できる
  const rejected = [
    "system.initiative",
    "system.resources.hp.max",
    "system.characteristics.physical.value",
    "system.mod.unknown",
    "system.unknownTable.foo.mod.bonus",
    "system.skills.search.mod",
    "system.skills.mod.bonus",
    "characteristics.physical.mod.bonus",
    "flags.emoklore.foo",
    "",
  ];

  for (const key of rejected) {
    it(`${key || "（空文字）"} は選択式では扱わない`, () => {
      expect(parseModifierKey(key)).toBeNull();
    });
  }

  it("表の名前が合っていても大文字小文字が違えば読み取らない", () => {
    expect(parseModifierKey("system.Skills.search.mod.bonus")).toBeNull();
  });
});

describe("composeTargetId / parseTargetId", () => {
  it("全体修正は global で表す", () => {
    expect(composeTargetId({ kind: "global" })).toBe("global");
    expect(parseTargetId("global")).toEqual({ kind: "global" });
  });

  it("表に属するものは 表.キー で表す", () => {
    const target = { kind: "collection", collection: "skills", key: "search" } as const;
    expect(composeTargetId(target)).toBe("skills.search");
    expect(parseTargetId("skills.search")).toEqual(target);
  });

  it("知らない表は読み取らない", () => {
    expect(parseTargetId("unknownTable.foo")).toBeNull();
    expect(parseTargetId("skills")).toBeNull();
    expect(parseTargetId("")).toBeNull();
  });
});
