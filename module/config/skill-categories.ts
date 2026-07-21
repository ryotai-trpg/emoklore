/**
 * カスタム技能の区分。ルールブックが技能を3つに分けているのに対応する。
 *
 * 組込の技能は「どの表に居るか」（`skills` / `baseSkills`）と `isExtra` フラグで
 * 区分を表しているが、カスタム技能は表が1つしかないので値として持つ。
 *
 * `config/` の他の定義と違って `CONFIG.EMOKLORE` には載せない。区分ごとの設定を
 * 持たない単なる列挙で、`attack-skills.ts` の `RangeType` と同じ扱いにしている。
 * そのため `check:schema-doc` の突き合わせ対象にもならない。
 */

export const SKILL_CATEGORIES = ["base", "normal", "extra"] as const;

export type SkillCategory = (typeof SKILL_CATEGORIES)[number];

/** 区分キーかどうか。保存データから来た文字列を絞るときに通す */
export const isSkillCategory = (value: string): value is SkillCategory =>
  (SKILL_CATEGORIES as readonly string[]).includes(value);

/**
 * スキーマの choices に渡す表。値は翻訳済み文字列ではなくi18nキー。
 *
 * 描画時に formInput の localize が解決する（`attackSkillChoices` と同じ理由で、
 * スキーマ定義の時点で `game.i18n` に触らない）
 */
export const skillCategoryChoices: Record<string, string> = Object.fromEntries(
  SKILL_CATEGORIES.map((key) => [key, `EMOKLORE.Item.skill.Category.${key}`]),
);
