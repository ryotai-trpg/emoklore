/**
 * ハウリング反応の見せ方と、共鳴表の引き方。
 *
 * `utils/resonance.ts` と同じ立ち位置で、保存データと `config/` の定義を合流させて
 * テンプレートに渡す形まで整える。引いた結果を誰に適用するかは `applications/` の担当。
 */

import { type HowlingCategory, howlingCategories } from "../config/howling-categories";
import { systemPath } from "../constants";
import type { KaiDataModel } from "../data/kai";
import { formatSkillRefs } from "./skill";

const DRAW_TEMPLATE = systemPath("templates/chat/howling-draw.hbs");

/** 本体の型に出ないメンバーだけを補う。共鳴表として使うぶんだけ */
type ResonanceTable = {
  uuid: string;
  name: string;
  replacement: boolean;
  roll: () => Promise<{ roll: foundry.dice.Roll | null; results: TableResult[] }>;
};

/** 引いた結果1件。本体の TableResult のうち、カードに写すぶんだけ */
type TableResult = {
  type: string;
  name: string;
  img: string | null;
  description: string;
  documentUuid: string | null;
};

/** 引いた結果カードに焼き込む内容。ChatMessage のサブタイプのスキーマと同じ形 */
export type HowlingDrawState = {
  actorUuid: string | null;
  name: string;
  kaiUuid: string | null;
  tableUuid: string | null;
  reactionName: string;
  reactionImg: string;
  category: HowlingCategory | "";
  description: string;
  /** 回復判定に使う技能の並び。「＊自我／心理」。判定で回復しないなら空文字 */
  recoverySkills: string;
  recoveryNote: string;
  itemUuid: string | null;
};

/**
 * 分類の表示名。
 *
 * `howlingCategories` の label はi18nキーのまま（スキーマの choices と共有しているので
 * preLocalize の対象にしていない）。翻訳は引く側で行う（`localizeSkillCategory` と同じ）。
 */
export const localizeHowlingCategory = (category: HowlingCategory): string =>
  game.i18n.localize(howlingCategories[category].label);

/**
 * 怪異に紐づいた共鳴表を引く。
 *
 * `resonanceTable` は型制約なしのUUIDではなく RollTable に絞ってあるが、参照先が消えている
 * ことはあるので、引けなければ null を返す。**RollTable#draw() は使わない** — `replacement:
 * false` の表で `updateEmbeddedDocuments` を呼ぶため（`client/documents/roll-table.mjs`）、
 * PLがGM所有の表を引くと権限エラーになる。`roll()` はDB書き込みが無い。
 */
export const resolveResonanceTable = async (
  kaiUuid: string | null,
): Promise<ResonanceTable | null> => {
  if (!kaiUuid) return null;

  const kai = (await foundry.utils.fromUuid(kaiUuid)) as { system?: KaiDataModel } | null;
  const tableUuid = kai?.system?.resonanceTable;
  if (!tableUuid) return null;

  const table = (await foundry.utils.fromUuid(tableUuid)) as ResonanceTable | null;

  // 参照先がRollTableでない（付け替え前のデータなど）場合も引けない扱いにする
  return typeof table?.roll === "function" ? table : null;
};

/**
 * 引いた結果を、カードに焼き込む形へ写す。
 *
 * document結果なら参照先の反応アイテムから、text結果なら結果そのものから読む。
 * **アイテムが消えたあとでもカードが読めるよう、表示に要る値は焼き込む**（武器カードと同じ）。
 */
export const buildHowlingDrawState = async (
  result: TableResult,
  context: { actorUuid: string | null; name: string; kaiUuid: string | null; tableUuid: string },
): Promise<HowlingDrawState> => {
  const base = {
    ...context,
    reactionName: result.name,
    reactionImg: result.img ?? "",
    category: "" as HowlingCategory | "",
    description: result.description,
    recoverySkills: "",
    recoveryNote: "",
    itemUuid: null as string | null,
  };

  if (result.type !== "document" || !result.documentUuid) return base;

  const item = (await foundry.utils.fromUuid(result.documentUuid)) as {
    name?: string;
    img?: string;
    type?: string;
    system?: {
      category: HowlingCategory;
      effect: string;
      recovery: { note: string; skills: Set<string> };
    };
  } | null;

  // 反応アイテム以外を指している表もありうる（GMが自分で組むため）。その場合は
  // リンクとして名前だけ出し、適用のボタンは出さない
  if (item?.type !== "howling" || !item.system) return base;

  return {
    ...base,
    reactionName: item.name || result.name,
    reactionImg: item.img || base.reactionImg,
    category: item.system.category,
    description: item.system.effect || result.description,
    recoverySkills: formatSkillRefs(item.system.recovery.skills),
    recoveryNote: item.system.recovery.note,
    itemUuid: result.documentUuid,
  };
};

/** 引いた結果カードのHTMLを組み立てる */
export const renderHowlingDrawCard = async (state: HowlingDrawState): Promise<string> =>
  foundry.applications.handlebars.renderTemplate(DRAW_TEMPLATE, {
    reactionName: state.reactionName,
    reactionImg: state.reactionImg,
    categoryLabel: state.category ? localizeHowlingCategory(state.category) : "",
    descriptionHTML: await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      state.description,
    ),
    recoverySkills: state.recoverySkills,
    recoveryNote: state.recoveryNote,
    // 反応アイテムを指していない結果は適用しようがないので、ボタンごと出さない
    canApply: Boolean(state.itemUuid && state.actorUuid),
  });
