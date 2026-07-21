/**
 * 技能の見せ方に関する小物。エモクロア固有だがルール計算ではないものを置く。
 *
 * `utils/weapon.ts` と同じ立ち位置で、`config/` の定義を翻訳・整形するところまでを持つ。
 */

import type { CharacteristicKey } from "../config/characteristics";
import { type SkillCategory, skillCategories } from "../config/skill-categories";
import type { SkillGroupKey } from "../config/skill-groups";

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
