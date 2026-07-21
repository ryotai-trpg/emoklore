import { describe, expect, it } from "vitest";
import type { EmotionAttributeConfig } from "../config/emotion-attributes";
import type { ResonantEmotionConfig } from "../config/resonant-emotions";
import {
  BIOGRAPHY_FIELDS,
  BIOGRAPHY_PAIRED_COUNT,
  buildBiographyRows,
  buildValueSegments,
  getEmotionRows,
} from "./helpers";

// performPreLocalization 済みの CONFIG を模す。label は翻訳済みの文字列になっている
const resonantEmotions: Record<string, ResonantEmotionConfig> = {
  possession: { label: "独占", attribute: "desire" },
  hope: { label: "希望", attribute: "ideal" },
};

const emotionAttributes: Record<string, EmotionAttributeConfig> = {
  desire: { label: "欲望" },
  ideal: { label: "理想" },
};

const rowsFor = (emotions: Record<string, string | undefined>) =>
  getEmotionRows(emotions, resonantEmotions, emotionAttributes);

describe("getEmotionRows", () => {
  it("感情名と属性名を翻訳済みの文字列で返す", () => {
    const rows = rowsFor({ surface: "possession", hidden: "hope", root: "possession" });

    expect(rows.surface).toEqual({ label: "独占", attribute: "欲望" });
    expect(rows.hidden).toEqual({ label: "希望", attribute: "理想" });
    expect(rows.root).toEqual({ label: "独占", attribute: "欲望" });
  });

  it("未選択の感情は空文字になる", () => {
    const rows = rowsFor({ surface: "possession" });

    expect(rows.hidden).toEqual({ label: "", attribute: "" });
    expect(rows.root).toEqual({ label: "", attribute: "" });
  });

  // 以前は `EMOKLORE.emotionAttributes.` という尻切れの言語キーを組み立てており、
  // それがそのままシートに表示されていた
  it("既知でない感情が保存されていても言語キーを漏らさない", () => {
    const rows = rowsFor({ surface: "unknownEmotion", hidden: "", root: undefined });

    for (const row of [rows.surface, rows.hidden, rows.root]) {
      expect(row).toEqual({ label: "", attribute: "" });
    }
  });

  it("属性の定義が欠けていても感情名だけは返す", () => {
    const rows = getEmotionRows({ surface: "possession" }, resonantEmotions, {});

    expect(rows.surface).toEqual({ label: "独占", attribute: "" });
  });

  it("3つのキーを必ず埋める", () => {
    expect(Object.keys(rowsFor({}))).toEqual(["surface", "hidden", "root"]);
  });
});

const biographyFields = {
  age: { label: "年齢" },
  gender: { label: "性別" },
  occupation: { label: "職業" },
  note: { label: "備考" },
};

describe("buildBiographyRows", () => {
  it("BIOGRAPHY_FIELDS の並びどおりに項目を返す", () => {
    const rows = buildBiographyRows(biographyFields, {});

    expect(rows.map((row) => row.key)).toEqual(BIOGRAPHY_FIELDS.map((field) => field.key));
  });

  it("ラベルと保存値を合流させる", () => {
    const rows = buildBiographyRows(biographyFields, { age: "17", occupation: "高校生" });
    const age = rows.find((row) => row.key === "age");

    expect(age).toMatchObject({ label: "年齢", value: "17", display: "17" });
  });

  it("定義にない項目のラベルと値は空文字にする", () => {
    const rows = buildBiographyRows({}, {});

    expect(rows.every((row) => row.label === "" && row.value === "")).toBe(true);
  });

  it("年齢・性別・職業・出身は inline、それ以外は違う", () => {
    const rows = buildBiographyRows(biographyFields, {});
    const inlineKeys = rows.filter((row) => row.inline).map((row) => row.key);

    expect(inlineKeys).toEqual(["age", "gender", "occupation", "hometown"]);
  });

  it("備考だけを html として扱う", () => {
    const rows = buildBiographyRows(biographyFields, {});
    const htmlKeys = rows.filter((row) => row.html).map((row) => row.key);

    expect(htmlKeys).toEqual(["note"]);
  });

  it("enrichHTML 済みの値は display にだけ反映し、value は保存値のまま残す", () => {
    const rows = buildBiographyRows(
      biographyFields,
      { note: "@UUID[Actor.x]{リンク}" },
      { note: "<a>リンク</a>" },
    );
    const note = rows.find((row) => row.key === "note");

    expect(note?.value).toBe("@UUID[Actor.x]{リンク}");
    expect(note?.display).toBe("<a>リンク</a>");
  });

  it("横並びにする組は先頭の年齢と性別", () => {
    const rows = buildBiographyRows(biographyFields, {});

    expect(rows.slice(0, BIOGRAPHY_PAIRED_COUNT).map((row) => row.key)).toEqual(["age", "gender"]);
  });
});

describe("buildValueSegments", () => {
  it("min から max までの段を作る", () => {
    expect(buildValueSegments(1, 6, 4).map((s) => s.value)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("現在値の段だけ checked になる", () => {
    const segments = buildValueSegments(1, 6, 4);
    expect(segments.filter((s) => s.checked).map((s) => s.value)).toEqual([4]);
  });

  it("0始まりの技能レベルも扱える", () => {
    const segments = buildValueSegments(0, 3, 0);
    expect(segments.map((s) => s.value)).toEqual([0, 1, 2, 3]);
    expect(segments[0]?.checked).toBe(true);
  });

  it("範囲外の現在値ではどの段も checked にならない", () => {
    // スキーマのバリデーションを通れば起きないが、壊れたデータで例外にはしない
    expect(buildValueSegments(1, 6, 99).some((s) => s.checked)).toBe(false);
  });
});
