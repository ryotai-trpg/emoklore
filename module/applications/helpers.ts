import type { EmotionAttributeKey, EmotionAttributesConfig } from "../config/emotion-attributes";
import type { ResonantEmotionsConfig } from "../config/resonant-emotions";
import type { BiographyFieldDef, BiographyRow, EmotionKey, EmotionRow } from "./types";

/**
 * シートのテンプレートに渡す選択肢やラベルを組み立てる。
 * ルール計算は module/rules/ に、DOM操作は module/utils/sheet.ts にある。
 */

const EMOTION_KEYS: readonly EmotionKey[] = ["surface", "hidden", "root"];

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

export const createEmotionOptions = (): Array<{ value: string; label: string; group: string }> => {
  return Object.entries(CONFIG.EMOKLORE.resonantEmotions).map(([value, { label, attribute }]) => {
    const attributeLabel =
      CONFIG.EMOKLORE.emotionAttributes[attribute as EmotionAttributeKey]?.label ?? "";
    return {
      value,
      label: game.i18n.localize("EMOKLORE.resonantEmotion", {
        emotion: label,
        attribute: attributeLabel,
      }),
      group: attributeLabel,
    };
  });
};

/**
 * 共鳴感情の表示名と、対応する属性の表示名を引く。
 *
 * どちらの label も i18nInit の performPreLocalization で翻訳済みなので、ここでは
 * 参照するだけでよい。以前は `EMOKLORE.emotionAttributes.` という言語キーを組み立てており、
 * 感情が未選択のときに尻切れのキーがそのままシートに表示されていた。キーを作らない形に
 * したので、未選択・未知の感情はどちらも空文字になる。
 *
 * game.i18n を呼ばない純粋関数なので、そのまま単体テストできる。
 */
export const getEmotionRows = (
  emotions: Record<string, string | undefined>,
  resonantEmotions: Record<string, ResonantEmotionsConfig>,
  emotionAttributes: Record<string, EmotionAttributesConfig>,
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
