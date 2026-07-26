/**
 * カスタム技能の区分。ルールブックが技能を3つに分けているのに対応する。
 *
 * 組込の技能は「どの表に居るか」（`skills` / `baseSkills`）と `isExtra` フラグで
 * 区分を表しているが、カスタム技能は表が1つしかないので値として持つ。
 *
 * `config/` の他の定義と違って **`CONFIG.EMOKLORE` には載せない。** 3つの意味は
 * コードに直接書かれていて（`base` がレベル1固定と目標値=能力値を、`extra` が
 * 技能ポイント2倍を決める）、汎用の仕組みに回っていない。`CONFIG` に出すと、
 * 4つ目のキーを足せばラジオとラベルは増えるのに挙動が何も付いてこない、
 * **存在しない拡張点を広告する**ことになる。他の表は全部が汎用に回されているので、
 * そこが違う。
 */

export interface SkillCategoryConfig {
  labelKey: string;
}

const definitions = {
  base: { labelKey: "EMOKLORE.Item.skill.Category.base" },
  normal: { labelKey: "EMOKLORE.Item.skill.Category.normal" },
  extra: { labelKey: "EMOKLORE.Item.skill.Category.extra" },
} satisfies Record<string, SkillCategoryConfig>;

export type SkillCategory = keyof typeof definitions;

// satisfies だけだと各値が個別の狭い型に推論されるため、値の型は SkillCategoryConfig に揃える。
// キーは literal のまま保たれるので SkillCategory が使える
export const skillCategories: Record<SkillCategory, SkillCategoryConfig> = definitions;

/** 区分の並び。作成ダイアログのラジオがこの順に出る */
export const SKILL_CATEGORIES = Object.keys(definitions) as SkillCategory[];

/** 区分キーかどうか。フォームの入力など、外から来た文字列を絞るときに通す */
export const isSkillCategory = (value: string): value is SkillCategory => value in definitions;

/**
 * スキーマの choices に渡す表。値は翻訳済み文字列ではなくi18nキー。
 *
 * 描画時に formInput の localize が解決する（`attackSkillChoices` と同じ理由で、
 * スキーマ定義の時点で翻訳に触らない）
 */
export const skillCategoryChoices: Record<string, string> = Object.fromEntries(
  Object.entries(definitions).map(([key, { labelKey }]) => [key, labelKey]),
);
