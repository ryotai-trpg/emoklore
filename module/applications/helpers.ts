import type { EmotionAttributeConfig } from "../config/emotion-attributes";
import type { ResonantEmotionConfig } from "../config/resonant-emotions";
import { SKILL_LEVEL_MAX, SKILL_LEVEL_MIN } from "../rules/limits";
import type { BiographyFieldDef, BiographyRow, EmotionKey, EmotionRow } from "./types";

/**
 * シートのテンプレートに渡す選択肢やラベルを組み立てる。
 * ルール計算は module/rules/ に、DOM操作は module/utils/sheet.ts にある。
 */

/** 表・裏・ルーツの並び。行の組み立てとピッカーの枠で同じ並びを使う */
export const EMOTION_KEYS: readonly EmotionKey[] = ["surface", "hidden", "root"];

/**
 * 経歴の項目の並び。
 *
 * inline はラベルと値を横に並べるもの、html は enrichHTML を通した文字列を
 * そのまま流し込むもの。閲覧と編集で同じ定義を使うので、項目を足すときは
 * ここだけを直せばよい。
 */
export const BIOGRAPHY_FIELDS: readonly BiographyFieldDef[] = [
  { key: "age", inline: true },
  { key: "gender", inline: true },
  { key: "occupation", inline: true },
  { key: "hometown", inline: true },
  { key: "appearance" },
  { key: "personality" },
  { key: "background" },
  { key: "importantPeople" },
  { key: "likesAndDislikes" },
  { key: "note", html: true },
];

/** 先頭の何件を横並びの組にするか。年齢と性別は並べて置く */
export const BIOGRAPHY_PAIRED_COUNT = 2;

/**
 * 経歴の表示用データを組み立てる。
 *
 * value は保存値そのままで、編集モードの formGroup に渡す。display は閲覧モードで
 * 出す文字列で、enrichHTML を通したものがあればそちらを使う。
 *
 * @param fields    systemFields.biography.fields
 * @param values    system.biography
 * @param enriched  enrichHTML 済みの値。閲覧時のみ values より優先する
 */
export const buildBiographyRows = (
  fields: Record<string, { label?: string }>,
  // 経歴の各項目は任意なので、保存値は string | undefined になる
  values: Record<string, string | undefined>,
  enriched: Record<string, string> = {},
): BiographyRow[] =>
  BIOGRAPHY_FIELDS.map(({ key, inline, html }) => ({
    key,
    label: fields[key]?.label ?? "",
    value: values[key] ?? "",
    display: enriched[key] ?? values[key] ?? "",
    field: fields[key],
    inline: inline ?? false,
    html: html ?? false,
  }));

/** 感情ピッカーの1マス。`key` は保存する感情キー、`label` は翻訳済みの表示名 */
export type EmotionCell = { key: string; label: string };

/** 感情ピッカーの1列。1つの感情属性とそこに属する感情 */
export type EmotionColumn = { attribute: string; label: string; emotions: EmotionCell[] };

/**
 * 感情ピッカーの列を組み立てる。属性ごとに1列、その中に属する感情を並べる。
 *
 * 感情の定義は属性キーを1つ持つだけの平らな表なので、属性から感情を引く向きは
 * ここで作る。列の並びは属性の表の順（欲望・情念・理想・関係・傷）で、列の中は
 * 感情の表の定義順。
 *
 * どちらの label も i18nInit の performPreLocalization で翻訳済みなので、
 * ここでは参照するだけでよい。game.i18n を呼ばない純粋関数なので、そのまま単体テストできる。
 */
export const buildEmotionColumns = (
  resonantEmotions: Record<string, ResonantEmotionConfig>,
  emotionAttributes: Record<string, EmotionAttributeConfig>,
): EmotionColumn[] => {
  const columns = new Map<string, EmotionColumn>();

  for (const [attribute, { label }] of Object.entries(emotionAttributes)) {
    columns.set(attribute, { attribute, label, emotions: [] });
  }

  for (const [key, { label, attribute }] of Object.entries(resonantEmotions)) {
    // 属性の表に載っていない感情にも列を作る。落とすとその感情を選ぶ手段が消える
    let column = columns.get(attribute);
    if (!column) {
      column = { attribute, label: "", emotions: [] };
      columns.set(attribute, column);
    }

    column.emotions.push({ key, label });
  }

  // 感情を1つも持たない属性は列にしない。空の列だけが並ぶのを避ける
  return Array.from(columns.values()).filter((column) => column.emotions.length > 0);
};

/**
 * 共鳴感情の表示名と、対応する属性の表示名を引く。
 *
 * どちらの label も i18nInit の performPreLocalization で翻訳済みなので、ここでは
 * 参照するだけでよい。言語キーをここで組み立てると、感情が未選択のときに尻切れのキー
 * （`EMOKLORE.emotionAttributes.`）がそのままシートに出る。キーを作らないので、
 * 未選択・未知の感情はどちらも空文字になる。
 *
 * game.i18n を呼ばない純粋関数なので、そのまま単体テストできる。
 */
export const getEmotionRows = (
  // 見るのは3枠だけ。`system.emotions` は追加取得（`acquired`）も持つが、行に出すのは
  // 表・裏・ルーツなので、余りを受け取らない形で宣言する
  emotions: Partial<Record<EmotionKey, string>>,
  resonantEmotions: Record<string, ResonantEmotionConfig>,
  emotionAttributes: Record<string, EmotionAttributeConfig>,
): Record<EmotionKey, EmotionRow> => {
  const rows = {} as Record<EmotionKey, EmotionRow>;

  for (const key of EMOTION_KEYS) {
    const emotionKey = emotions[key];
    const emotion = emotionKey ? resonantEmotions[emotionKey] : undefined;
    const attribute = emotion ? emotionAttributes[emotion.attribute] : undefined;

    rows[key] = { label: emotion?.label ?? "", attribute: attribute?.label ?? "" };
  }

  return rows;
};

/** 段で値を選ぶ入力の1段ぶん */
export type ValueSegment = {
  value: number;
  /** いま選ばれている段 */
  checked: boolean;
};

/**
 * 能力値・技能レベルを段で選ぶ入力の、段の並びを作る。
 *
 * 塗り（どこまで色が乗るか）はCSSの `:has()` で出すので、ここでは持たない。
 * 選択の即時反映を再描画待ちにしないため。
 *
 * game.i18n を呼ばない純粋関数なので、そのまま単体テストできる。
 */
export const buildValueSegments = (min: number, max: number, current: number): ValueSegment[] => {
  const segments: ValueSegment[] = [];
  for (let value = min; value <= max; value++) {
    segments.push({ value, checked: value === current });
  }
  return segments;
};

/**
 * 技能レベルの段。組込技能もカスタム技能も同じ並びを使う。
 *
 * Lv.0 の段は置かない。バーの左端が常に空いて見えるのを嫌ったため、未修得へは
 * 「選択中の段をもう一度押す」で戻す（`resolveSegmentValue` がその判断を持つ）。
 */
export const buildSkillLevelSegments = (current: number): ValueSegment[] =>
  buildValueSegments(SKILL_LEVEL_MIN + 1, SKILL_LEVEL_MAX, current);

/**
 * 段をクリックしたときに書き込む値。押し直しなら未修得へ戻す。
 *
 * ラジオは押しても外れないので、0 に戻す手段がこれしかない。書き込み先が
 * アクターでもアイテムでも判断は同じなので、値を決めるところだけを純粋関数にしてある。
 *
 * `null` は「書かない」。戻せない入力（能力値は1未満にならない）で押し直したときに返る。
 */
export const resolveSegmentValue = (
  value: number,
  current: number,
  clearTo: number | undefined,
): number | null => {
  if (value !== current) return value;
  return clearTo === undefined ? null : clearTo;
};
