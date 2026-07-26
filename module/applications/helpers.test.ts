import { describe, expect, it } from "vitest";
import type { EmotionAttributeConfig } from "../config/emotion-attributes";
import type { ResonantEmotionConfig } from "../config/resonant-emotions";
import {
  BIOGRAPHY_FIELDS,
  BIOGRAPHY_PAIRED_COUNT,
  buildBiographyRows,
  buildEmotionColumns,
  buildSkillLevelSegments,
  buildValueSegments,
  getAcquiredEmotionRows,
  getEmotionRows,
  resolveSegmentValue,
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

  // 言語キーを組み立てる形にすると、尻切れのキー（`EMOKLORE.Config.emotionAttributes.`）が
  // そのままシートに表示される
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

describe("getAcquiredEmotionRows", () => {
  const acquiredRowsFor = (acquired: Iterable<string>) =>
    getAcquiredEmotionRows(acquired, resonantEmotions, emotionAttributes);

  it("追加取得した順に感情名と属性名を返す", () => {
    expect(acquiredRowsFor(["hope", "possession"])).toEqual([
      { label: "希望", attribute: "理想" },
      { label: "独占", attribute: "欲望" },
    ]);
  });

  // 3枠と違って枠そのものが無いので、既知でないキーは行ごと落とす
  it("既知でない感情は行にしない", () => {
    expect(acquiredRowsFor(["unknownEmotion", "hope"])).toEqual([
      { label: "希望", attribute: "理想" },
    ]);
  });

  it("属性の定義が欠けていても感情名だけは返す", () => {
    expect(getAcquiredEmotionRows(["hope"], resonantEmotions, {})).toEqual([
      { label: "希望", attribute: "" },
    ]);
  });

  it("1つも取得していなければ空になる", () => {
    expect(acquiredRowsFor([])).toEqual([]);
  });
});

describe("buildEmotionColumns", () => {
  it("属性ごとに列を作り、列の中は感情の定義順に並べる", () => {
    const columns = buildEmotionColumns(
      { hope: { label: "希望", attribute: "ideal" }, order: { label: "秩序", attribute: "ideal" } },
      emotionAttributes,
    );

    expect(columns).toEqual([
      {
        attribute: "ideal",
        label: "理想",
        emotions: [
          { key: "hope", label: "希望" },
          { key: "order", label: "秩序" },
        ],
      },
    ]);
  });

  // 列の並びはルールブックの属性の並び。感情の表がどの順で定義されていても変わらない
  it("列の並びは属性の表の順にする", () => {
    const columns = buildEmotionColumns(resonantEmotions, emotionAttributes);

    expect(columns.map((column) => column.attribute)).toEqual(["desire", "ideal"]);
  });

  it("感情を1つも持たない属性は列にしない", () => {
    const columns = buildEmotionColumns(
      { hope: { label: "希望", attribute: "ideal" } },
      emotionAttributes,
    );

    expect(columns.map((column) => column.attribute)).toEqual(["ideal"]);
  });

  // 落とすとその感情を選ぶ手段が消える。属性の表に足し忘れたことが分かるよう、
  // 見出しは空のまま列として出す
  it("属性の定義が欠けていても感情は列にして出す", () => {
    const columns = buildEmotionColumns(resonantEmotions, { ideal: { label: "理想" } });

    expect(columns).toContainEqual({
      attribute: "desire",
      label: "",
      emotions: [{ key: "possession", label: "独占" }],
    });
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

describe("buildSkillLevelSegments", () => {
  it("Lv.0 の段は置かず、1から上限までを出す", () => {
    expect(buildSkillLevelSegments(0).map((s) => s.value)).toEqual([1, 2, 3]);
  });

  it("修得済みならその段が checked になる", () => {
    expect(
      buildSkillLevelSegments(2)
        .filter((s) => s.checked)
        .map((s) => s.value),
    ).toEqual([2]);
  });

  it("未修得ではどの段も checked にならない", () => {
    expect(buildSkillLevelSegments(0).some((s) => s.checked)).toBe(false);
  });
});

describe("resolveSegmentValue", () => {
  it("選択中でない段を押したらその値になる", () => {
    expect(resolveSegmentValue(3, 1, 0)).toBe(3);
  });

  it("選択中の段を押し直したら clearTo に戻る", () => {
    expect(resolveSegmentValue(2, 2, 0)).toBe(0);
  });

  // 能力値の段は1未満にならないので clearTo を持たない。押し直しても何も起きない
  it("clearTo が無い入力を押し直したら書かない", () => {
    expect(resolveSegmentValue(4, 4, undefined)).toBeNull();
  });

  it("clearTo が無くても、別の段を押すぶんには書く", () => {
    expect(resolveSegmentValue(5, 4, undefined)).toBe(5);
  });

  it("clearTo が0以外でも戻り先として使える", () => {
    expect(resolveSegmentValue(1, 1, 1)).toBe(1);
  });
});
