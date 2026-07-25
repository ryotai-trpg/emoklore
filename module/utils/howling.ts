/**
 * ハウリング反応の見せ方に関する小物。
 *
 * `utils/skill.ts` と同じ立ち位置で、`config/` の定義を翻訳・整形するところまでを持つ。
 */

import { type HowlingCategory, howlingCategories } from "../config/howling-categories";

/**
 * 分類の表示名。
 *
 * `howlingCategories` の label はi18nキーのまま（スキーマの choices と共有しているので
 * preLocalize の対象にしていない）。翻訳は引く側で行う（`localizeSkillCategory` と同じ）。
 */
export const localizeHowlingCategory = (category: HowlingCategory): string =>
  game.i18n.localize(howlingCategories[category].label);
