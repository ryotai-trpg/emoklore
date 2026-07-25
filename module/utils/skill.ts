/**
 * 技能の見せ方に関する小物。エモクロア固有だがルール計算ではないものを置く。
 *
 * `utils/weapon.ts` と同じ立ち位置で、`config/` の定義を翻訳・整形するところまでを持つ。
 */

import type { CharacteristicKey } from "../config/characteristics";
import { type SkillCategory, skillCategories } from "../config/skill-categories";
import type { SkillGroupKey } from "../config/skill-groups";
import { typedEntries } from "./object";

/**
 * 技能名の頭に付ける印。基本技能は `＊`、エクストラ技能は `★`。
 *
 * チャットの見出し（`utils/chat.ts`）と効果の適用先の選択肢
 * （`applications/active-effect-config.ts`）が同じ印を使っており、綴りを1箇所にまとめる。
 */
export const skillMarker = (isBase: boolean, isExtra: boolean): string =>
  isBase ? "＊" : isExtra ? "★" : "";

/**
 * カスタム技能の区分の表示名。
 *
 * `skillCategories` の label はi18nキーのまま（スキーマの choices と共有しているので
 * preLocalize の対象にしていない）。翻訳は引く側で行う。
 */
export const localizeSkillCategory = (category: SkillCategory): string =>
  game.i18n.localize(skillCategories[category].label);

/** 能力値の表示名。CONFIG.EMOKLORE の label は i18nInit で翻訳済み */
const localizeCharacteristic = (key: CharacteristicKey): string =>
  CONFIG.EMOKLORE.characteristics[key].label;

/**
 * 参照能力値の並び。複数あるものは「身体／器用」のように連ねる。
 *
 * ルールブックは【身体 or 器用】と書くが、シートの列は狭いので区切りだけにしている。
 * 組込技能の `docs/data-model.md` の表も同じ「／」で並べている。
 */
export const formatCharacteristicOptions = (options: Iterable<CharacteristicKey>): string =>
  [...options].map(localizeCharacteristic).join("／");

/** 技能グループの表示名。所属しないカスタム技能は「なし」 */
export const formatSkillGroup = (group: SkillGroupKey | ""): string =>
  group ? CONFIG.EMOKLORE.skillGroups[group].label : game.i18n.localize("EMOKLORE.Common.none");

/**
 * 表に居る技能への参照。保存データや選択の値に書ける形。
 *
 * `data/character-like.ts` の `SkillRef` にはカスタム技能（表ではなくアイテムのidで指す）が
 * 入るが、カスタム技能はアクター固有なので、配り物やDLの要求からは指せない。ここはその
 * 指せるぶんだけを持つ。`data/messages/skill-request.ts` の `RequestedSkill` も同じ形。
 */
export type StoredSkillRef = {
  kind: "skill" | "base";
  key: string;
};

/** 選択肢の value は「経路:キー」。selectの値は1本の文字列にしかならないので繋ぐ */
export const SKILL_REF_SEPARATOR = ":";

/**
 * 技能をひとつ選ばせるときの選択肢。通常技能と基本技能の2グループに分ける。
 *
 * 印（★ / ＊）を付けてシートの表記と揃える。47感情のような一望の必要は無いので、
 * 専用のピッカーは作らず optgroup 付きの素の select で足りる。
 */
export const buildSkillRefGroups = (): Array<{
  label: string;
  skills: Array<{ value: string; label: string }>;
}> => [
  {
    label: game.i18n.localize("EMOKLORE.SkillRequest.NormalSkills"),
    skills: typedEntries(CONFIG.EMOKLORE.skills).map(([key, { label, isExtra }]) => ({
      value: `skill${SKILL_REF_SEPARATOR}${key}`,
      label: `${skillMarker(false, isExtra ?? false)}${label}`,
    })),
  },
  {
    label: game.i18n.localize("EMOKLORE.SkillRequest.BaseSkills"),
    skills: typedEntries(CONFIG.EMOKLORE.baseSkills).map(([key, { label }]) => ({
      value: `base${SKILL_REF_SEPARATOR}${key}`,
      label: `${skillMarker(true, false)}${label}`,
    })),
  },
];

/** 「経路:キー」を分解する。value は自分で組んだものなので、経路は base 以外を skill に倒す */
export const parseSkillRefValue = (value: string): StoredSkillRef => {
  const [kind, key = ""] = value.split(SKILL_REF_SEPARATOR);
  return { kind: kind === "base" ? "base" : "skill", key };
};

/** 参照を「経路:キー」に戻す。選択の初期値を組むときに使う */
export const toSkillRefValue = ({ kind, key }: StoredSkillRef): string =>
  `${kind}${SKILL_REF_SEPARATOR}${key}`;
