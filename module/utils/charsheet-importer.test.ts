import { describe, expect, it } from "vitest";
import { buildLabelIndex, parseEmotions, parseSkills } from "./charsheet-importer";

// CONFIG.EMOKLORE の一部を模したもの。実物と同じく label は翻訳済みの文字列が入る
const emotions = buildLabelIndex({
  anger: { label: "怒り" },
  sorrow: { label: "哀しみ" },
  joy: { label: "喜び" },
  guilt: { label: "罪悪感" },
});

const skillIndex = {
  skills: buildLabelIndex({
    search: { label: "検索" },
    taste: { label: "毒見" },
    strongLuck: { label: "強運" },
    specializedKnowledge: { label: "専門知識" },
    secretTechnique: { label: "奥義" },
  }),
  baseSkills: buildLabelIndex({
    investigation: { label: "調査" },
    treatment: { label: "手当て" },
  }),
};

describe("buildLabelIndex", () => {
  it("表示名からキーを引ける形に反転する", () => {
    expect(buildLabelIndex({ search: { label: "検索" } })).toEqual({ 検索: "search" });
  });

  it("空の定義は空の索引になる", () => {
    expect(buildLabelIndex({})).toEqual({});
  });
});

describe("parseEmotions", () => {
  it("表・裏・ルーツをキーに変換する", () => {
    const memo = "共鳴感情・表: 怒り(情念)\n共鳴感情・裏: 哀しみ\n共鳴感情・ルーツ: 喜び";

    expect(parseEmotions(memo, emotions)).toEqual({
      emotions: { surface: "anger", hidden: "sorrow", root: "joy" },
      unrecognized: [],
    });
  });

  it("全角コロンと中黒の異体字も拾う", () => {
    expect(parseEmotions("共鳴感情·表：怒り", emotions).emotions.surface).toBe("anger");
  });

  it.each([
    ["半角括弧", "共鳴感情・表: 罪悪感(傷)"],
    ["全角括弧", "共鳴感情・表: 罪悪感（傷）"],
  ])("属性の括弧書きは無視する（%s）", (_name, memo) => {
    expect(parseEmotions(memo, emotions).emotions.surface).toBe("guilt");
  });

  it("記載のない欄は設定しない", () => {
    const result = parseEmotions("共鳴感情・表: 怒り", emotions);

    expect(result.emotions).toEqual({ surface: "anger" });
    expect(result.unrecognized).toEqual([]);
  });

  it("未知のラベルは取り込まず unrecognized に集める", () => {
    // 「悲しみ」は表記ゆれ（正しくは「哀しみ」）
    const result = parseEmotions("共鳴感情・表: 怒り\n共鳴感情・裏: 悲しみ", emotions);

    expect(result.emotions).toEqual({ surface: "anger" });
    expect(result.emotions.hidden).toBeUndefined();
    expect(result.unrecognized).toEqual(["悲しみ"]);
  });

  it("共鳴感情の記載がまったくなければ空", () => {
    expect(parseEmotions("ただのメモ", emotions)).toEqual({ emotions: {}, unrecognized: [] });
  });
});

describe("parseSkills", () => {
  it("ダイス数がそのまま技能レベルになる", () => {
    expect(parseSkills("2DM<=4 〈検索〉", skillIndex).skills).toEqual({ search: 2 });
  });

  it("★のエクストラ技能も記号を外して引く", () => {
    expect(parseSkills("1DM<=2 〈★強運〉", skillIndex).skills).toEqual({ strongLuck: 1 });
  });

  it("＊の基本技能は常にレベル1", () => {
    expect(parseSkills("1DM<=5 〈＊調査〉", skillIndex).baseSkills).toEqual({ investigation: 1 });
  });

  // 保管所の出力は全角括弧、シートの表示はコロン。どちらも受ける
  it.each([
    ["全角括弧（保管所の実際の出力）", "3DM<=8 〈専門知識（考古学）〉"],
    ["半角括弧", "3DM<=8 〈専門知識(考古学)〉"],
    ["全角コロン（シートの表示形式）", "3DM<=8 〈専門知識：考古学〉"],
    ["半角コロン", "3DM<=8 〈専門知識:考古学〉"],
  ])("特化名を技能名から切り離す（%s）", (_name, line) => {
    const result = parseSkills(line, skillIndex);

    expect(result.skills).toEqual({ specializedKnowledge: 3 });
    expect(result.specializations).toEqual({ specializedKnowledge: "考古学" });
  });

  it("記号と特化名が両方付いていても引ける", () => {
    const result = parseSkills("3DM<=8 〈★奥義（ああ）〉", skillIndex);

    expect(result.skills).toEqual({ secretTechnique: 3 });
    expect(result.specializations).toEqual({ secretTechnique: "ああ" });
  });

  it("特化名が空でも技能は取り込む", () => {
    const result = parseSkills("3DM<=8 〈専門知識（）〉", skillIndex);

    expect(result.skills).toEqual({ specializedKnowledge: 3 });
    expect(result.specializations).toEqual({});
  });

  it("技能レベルは0〜3に丸める", () => {
    expect(parseSkills("9DM<=4 〈検索〉", skillIndex).skills).toEqual({ search: 3 });
  });

  it("索引に無い技能は取り込まず unrecognized に集める", () => {
    // 「毒味」は表記ゆれ（正しくは「毒見」）
    const result = parseSkills("2DM<=4 〈検索〉\n1DM<=7 〈毒味〉", skillIndex);

    expect(result.skills).toEqual({ search: 2 });
    expect(result.unrecognized).toEqual(["毒味"]);
  });

  it("未知の基本技能は＊付きで報告する", () => {
    expect(parseSkills("1DM<=5 〈＊未知〉", skillIndex).unrecognized).toEqual(["＊未知"]);
  });

  it("共鳴の行は変数を含むので拾わない", () => {
    expect(parseSkills("{共鳴}DM<={強度} 〈∞共鳴〉", skillIndex).skills).toEqual({});
  });

  it("技能の記載がまったくなければ空", () => {
    expect(parseSkills("ただのメモ", skillIndex)).toEqual({
      skills: {},
      specializations: {},
      baseSkills: {},
      unrecognized: [],
    });
  });
});
