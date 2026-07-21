export interface CharacteristicConfig {
  label: string;
  fa: string;
}

const definitions = {
  physical: {
    label: "EMOKLORE.Actor.characteristics.physical",
    fa: "fa-person-running",
  },
  dexterity: {
    label: "EMOKLORE.Actor.characteristics.dexterity",
    fa: "fa-hand-sparkles",
  },
  mentality: {
    label: "EMOKLORE.Actor.characteristics.mentality",
    fa: "fa-face-meh-blank",
  },
  sensitivity: {
    label: "EMOKLORE.Actor.characteristics.sensitivity",
    fa: "fa-ear-listen",
  },
  intelligence: {
    label: "EMOKLORE.Actor.characteristics.intelligence",
    fa: "fa-book-open",
  },
  charisma: {
    label: "EMOKLORE.Actor.characteristics.charisma",
    fa: "fa-face-kiss-wink-heart",
  },
  sociality: {
    label: "EMOKLORE.Actor.characteristics.sociality",
    fa: "fa-id-card",
  },
  fortune: {
    label: "EMOKLORE.Actor.characteristics.fortune",
    fa: "fa-dice-six",
  },
} satisfies Record<string, CharacteristicConfig>;

export type CharacteristicKey = keyof typeof definitions;

// satisfies だけだと各値が個別の狭い型に推論されるため、値の型は CharacteristicConfig に揃える。
// キーは literal のまま保たれるので CharacteristicKey が使える
export const characteristics: Record<CharacteristicKey, CharacteristicConfig> = definitions;

/** 能力値キーかどうか。保存データやDOMのdatasetから来た文字列を絞るときに通す */
export const isCharacteristicKey = (value: string): value is CharacteristicKey =>
  value in definitions;

/**
 * スキーマの choices に渡す表。値は翻訳済み文字列ではなくi18nキーを入れる。
 *
 * `characteristics` の label は i18nInit の performPreLocalization がその場で翻訳結果に
 * 差し替えるが、こちらはモジュールの読み込み時に文字列を写し取っているので影響を受けない
 * （文字列は不変で、差し替わるのは characteristics 側の参照だけ）。
 * 描画時に formInput の localize が解決する（attackSkillChoices と同じ扱い）
 */
export const characteristicChoices: Record<string, string> = Object.fromEntries(
  Object.entries(definitions).map(([key, { label }]) => [key, label]),
);
