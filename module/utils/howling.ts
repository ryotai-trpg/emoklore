/**
 * ハウリング反応の見せ方と、共鳴表の引き方。
 *
 * `config/` の定義を翻訳して、シートに並べる行まで整える。引いた結果をカードにするのは
 * `chat/howling-draw.ts`、誰に適用するかは `applications/howling.ts` の担当。
 */

import { type HowlingCategory, howlingCategories } from "../config/howling-categories";
import type { KaiDataModel } from "../data/kai";
import { type SkillRollShortcut, toSkillRollShortcuts } from "./skill";

/** 本体の型に出ないメンバーだけを補う。共鳴表として使うぶんだけ */
type ResonanceTable = {
  uuid: string;
  name: string;
  replacement: boolean;
  roll: () => Promise<{ roll: foundry.dice.Roll | null; results: TableResult[] }>;
};

/** 引いた結果1件。本体の TableResult のうち、カードに写すぶんだけ */
export type TableResult = {
  type: string;
  name: string;
  img: string | null;
  description: string;
  documentUuid: string | null;
};

/**
 * 分類の表示名。
 *
 * `howlingCategories` の label はi18nキーのまま（スキーマの choices と共有しているので
 * preLocalize の対象にしていない）。翻訳は引く側で行う（`localizeSkillCategory` と同じ）。
 */
export const localizeHowlingCategory = (category: HowlingCategory): string =>
  _loc(howlingCategories[category].label);

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

/** 効果タブのハウリング区分に描く1行 */
export type HowlingRow = {
  id: string;
  name: string;
  img: string;
  categoryLabel: string;
  /** 回復判定のショートカット。押すとその技能で判定が飛ぶ */
  recoverySkills: SkillRollShortcut[];
  recoveryNote: string;
};

/** 行に写すぶんだけを構造的に受ける（`data/` から `documents/` を参照しない決まりと同じ形） */
type HowlingItemLike = {
  id: string;
  name: string;
  img: string;
  system: {
    category: HowlingCategory;
    recovery: { note: string; skills: Set<string> };
  };
};

/**
 * いま受けているハウリング反応を、効果タブに描く形へ写す。
 *
 * **アイテムそのものを並べる。** 反応が持つ効果（transfer）は一時的／永続的の区分から
 * 除いてあり、代わりにこの行が「いま何を受けているか」を1件1行で見せる。効果を持たない
 * 反応（RPだけのもの）も同じように並ぶのは、それも受けている状態には違いないため。
 */
export const prepareHowlingRows = (items: Iterable<HowlingItemLike>): HowlingRow[] =>
  [...items].map((item) => ({
    id: item.id,
    name: item.name,
    img: item.img,
    categoryLabel: localizeHowlingCategory(item.system.category),
    recoverySkills: toSkillRollShortcuts(item.system.recovery.skills),
    recoveryNote: item.system.recovery.note,
  }));
