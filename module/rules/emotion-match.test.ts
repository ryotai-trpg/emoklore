import { describe, expect, it } from "vitest";
import { type EmotionMatchParams, resolveEmotionMatch } from "./emotion-match";

// 感情3つで足りる。possession と instinct は同じ属性、hope だけ別
const ATTRIBUTES: Record<string, string> = {
  possession: "desire",
  instinct: "desire",
  hope: "ideal",
};

const match = (
  p: Partial<EmotionMatchParams> & {
    owned: EmotionMatchParams["owned"];
    requested: readonly string[];
  },
) => resolveEmotionMatch({ attributeOf: (key) => ATTRIBUTES[key], ...p });

describe("resolveEmotionMatch", () => {
  it("持っている感情と同一なら完全一致", () => {
    expect(match({ owned: { all: ["hope"], root: undefined }, requested: ["hope"] })).toBe(
      "completely",
    );
  });

  // 共振で得た感情も《怪異》が付与した感情も、ルール上は共鳴者の共鳴感情として同じ
  it("追加取得した感情でも完全一致になる", () => {
    expect(
      match({ owned: { all: ["possession", "hope"], root: "possession" }, requested: ["hope"] }),
    ).toBe("completely");
  });

  it("ルーツの属性だけが一致すればルーツ属性一致", () => {
    expect(
      match({ owned: { all: ["instinct"], root: "instinct" }, requested: ["possession"] }),
    ).toBe("root");
  });

  // 属性一致を見るのはルーツだけ。表や裏が同じ属性でも上がらない
  it("ルーツ以外の感情の属性が一致しても一致なし", () => {
    expect(match({ owned: { all: ["instinct"], root: "hope" }, requested: ["possession"] })).toBe(
      "none",
    );
  });

  // ルーツそのものが指定と同一なら属性も当然一致している。大きい方だけを採る
  it("完全一致とルーツ属性一致が重なったら完全一致", () => {
    expect(
      match({ owned: { all: ["possession"], root: "possession" }, requested: ["possession"] }),
    ).toBe("completely");
  });

  it("指定が無ければ一致なし", () => {
    expect(match({ owned: { all: ["hope"], root: "hope" }, requested: [] })).toBe("none");
  });

  it("ルーツが未選択なら属性一致は起きない", () => {
    expect(match({ owned: { all: ["hope"], root: undefined }, requested: ["possession"] })).toBe(
      "none",
    );
  });

  // 属性を引けないキーどうしを「どちらも undefined だから一致」にしない
  it("属性を引けない感情は一致に数えない", () => {
    expect(
      match({ owned: { all: ["unknown"], root: "unknown" }, requested: ["alsoUnknown"] }),
    ).toBe("none");
  });

  // 《怪異》は共鳴感情を複数持つ。DLはまとめて鳴らし、共鳴者はどれかに一致すればよい
  it("複数の指定はいずれか1つでも一致すれば成立する", () => {
    expect(
      match({ owned: { all: ["hope"], root: "hope" }, requested: ["possession", "hope"] }),
    ).toBe("completely");
  });

  it("複数の指定でルーツ属性一致だけが成立することもある", () => {
    expect(
      match({ owned: { all: ["instinct"], root: "instinct" }, requested: ["hope", "possession"] }),
    ).toBe("root");
  });

  // 感情の数だけ広げても「重複せず大きい方のみ」は変わらない。積み上がらない
  it("完全一致とルーツ属性一致が別々の指定で成立したら完全一致だけを採る", () => {
    expect(
      match({
        owned: { all: ["instinct", "hope"], root: "instinct" },
        requested: ["possession", "hope"],
      }),
    ).toBe("completely");
  });

  it("どれにも一致しなければ一致なし", () => {
    expect(
      match({ owned: { all: ["hope"], root: "hope" }, requested: ["possession", "instinct"] }),
    ).toBe("none");
  });
});
