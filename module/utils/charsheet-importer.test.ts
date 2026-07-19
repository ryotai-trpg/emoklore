import { describe, expect, it } from "vitest";
import { parseEmotions } from "./charsheet-importer";

describe("parseEmotions", () => {
  it("表・裏・ルーツをキーに変換する", () => {
    const memo = "共鳴感情・表: 怒り(情念)\n共鳴感情・裏: 哀しみ\n共鳴感情・ルーツ: 喜び";

    expect(parseEmotions(memo)).toEqual({
      emotions: { surface: "anger", hidden: "sorrow", root: "joy" },
      unrecognized: [],
    });
  });

  it("全角コロンと中黒の異体字も拾う", () => {
    expect(parseEmotions("共鳴感情·表：怒り").emotions.surface).toBe("anger");
  });

  it.each([
    ["半角括弧", "共鳴感情・表: 罪悪感(傷)"],
    ["全角括弧", "共鳴感情・表: 罪悪感（傷）"],
  ])("属性の括弧書きは無視する（%s）", (_name, memo) => {
    expect(parseEmotions(memo).emotions.surface).toBe("guilt");
  });

  it("記載のない欄は設定しない", () => {
    const result = parseEmotions("共鳴感情・表: 怒り");

    expect(result.emotions).toEqual({ surface: "anger" });
    expect(result.unrecognized).toEqual([]);
  });

  it("未知のラベルは取り込まず unrecognized に集める", () => {
    // 「悲しみ」は表記ゆれ（正しくは「哀しみ」）
    const result = parseEmotions("共鳴感情・表: 怒り\n共鳴感情・裏: 悲しみ");

    expect(result.emotions).toEqual({ surface: "anger" });
    expect(result.emotions.hidden).toBeUndefined();
    expect(result.unrecognized).toEqual(["悲しみ"]);
  });

  it("共鳴感情の記載がまったくなければ空", () => {
    expect(parseEmotions("ただのメモ")).toEqual({ emotions: {}, unrecognized: [] });
  });
});
