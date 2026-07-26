/**
 * ハウリング反応の分類。ルールブックが反応ひとつずつに添えている7種のタグ。
 *
 * **表示にしか使わない。** 公式サイトにも分類がゲーム上どう働くかの規定は無く、判定にも
 * 回復にも効かない。`skill-categories` と同じく **`CONFIG.EMOKLORE` には載せない**が、
 * 理由は逆向きになる。あちらは3つの意味がコードに直接書かれていて汎用の仕組みに
 * 回っていないから載せない。こちらは**どこからも読まれない純粋なラベル**なので、
 * `CONFIG` に出しても増やせるのは選択肢の文字列だけで、載せる意味がない。
 *
 * 反応そのものの効果は ActiveEffect が持つ（`docs/active-effect.md`）。分類から効果を
 * 導く道は無いので、ここに `label` 以外を足す必要が出たら、それは分類ではなく別の何かになる。
 */

export interface HowlingCategoryConfig {
  labelKey: string;
}

const definitions = {
  reflex: { labelKey: "EMOKLORE.Item.howling.Category.reflex" },
  denial: { labelKey: "EMOKLORE.Item.howling.Category.denial" },
  agitation: { labelKey: "EMOKLORE.Item.howling.Category.agitation" },
  rejection: { labelKey: "EMOKLORE.Item.howling.Category.rejection" },
  attunement: { labelKey: "EMOKLORE.Item.howling.Category.attunement" },
  acceptance: { labelKey: "EMOKLORE.Item.howling.Category.acceptance" },
  unclassified: { labelKey: "EMOKLORE.Item.howling.Category.unclassified" },
} satisfies Record<string, HowlingCategoryConfig>;

export type HowlingCategory = keyof typeof definitions;

// satisfies だけだと各値が個別の狭い型に推論されるため、値の型は HowlingCategoryConfig に
// 揃える。キーは literal のまま保たれるので HowlingCategory が使える
export const howlingCategories: Record<HowlingCategory, HowlingCategoryConfig> = definitions;

/** 分類キーかどうか。フォームの入力など、外から来た文字列を絞るときに通す */
export const isHowlingCategory = (value: string): value is HowlingCategory => value in definitions;

/**
 * スキーマの choices に渡す表。値は翻訳済み文字列ではなくi18nキー。
 *
 * 描画時に formInput の localize が解決する（`skillCategoryChoices` と同じ理由で、
 * スキーマ定義の時点で翻訳に触らない）
 */
export const howlingCategoryChoices: Record<string, string> = Object.fromEntries(
  Object.entries(definitions).map(([key, { labelKey }]) => [key, labelKey]),
);
