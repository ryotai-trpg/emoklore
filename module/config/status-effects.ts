/**
 * トークンに付けられる状態。`CONFIG.statusEffects` に流し込む。
 *
 * 他の表と違って `label` ではなく `name` を持つのは、本体の StatusEffectConfig が
 * そのキー名で読むため。翻訳は `ActiveEffect.fromStatusEffect` が
 * `_loc(effectData.name)` で解決するので、preLocalize の対象にはしない。
 *
 * `showIcon` は指定しない。本体が `fromStatusEffect` で `??= ALWAYS` を入れており
 * （v14 で `isTemporary` の判定から `statuses` が外れたぶんの手当て）、
 * 期限を持たない状態でもトークンにアイコンが出る。
 */
export interface StatusEffectConfig {
  name: string;
  img: string;
  /**
   * トークンHUDでの並び順。
   *
   * 指定しないと本体が `order ?? 0` で揃えたうえで表示名の localeCompare に倒すので、
   * ルール上の進行（気絶→心肺停止→死亡）が五十音順に崩れる。
   */
  order: number;
}

const definitions = {
  // HPが尽きる側の3つ。ルール上は 気絶 → 心肺停止 → 死亡 の順に進む
  unconscious: {
    name: "EMOKLORE.Status.unconscious",
    img: "icons/svg/unconscious.svg",
    order: 1,
  },
  cardiacArrest: {
    name: "EMOKLORE.Status.cardiacArrest",
    img: "icons/svg/blood.svg",
    order: 2,
  },
  dead: {
    name: "EMOKLORE.Status.dead",
    img: "icons/svg/skull.svg",
    order: 3,
  },

  // MPが尽きたとき
  faint: {
    name: "EMOKLORE.Status.faint",
    img: "icons/svg/daze.svg",
    order: 4,
  },

  // 《怪異》に持っていかれる側の2つ
  possessed: {
    name: "EMOKLORE.Status.possessed",
    img: "icons/svg/terror.svg",
    order: 5,
  },
  deviation: {
    name: "EMOKLORE.Status.deviation",
    img: "icons/svg/cowled.svg",
    order: 6,
  },

  // ここから下はルールブックに規定が無い。本体の視界・探知が
  // CONFIG.specialStatusEffects 経由でこの2つを見ているので、
  // エモクロアの状態に置き換えるときも落とさずに残す
  blind: {
    name: "EMOKLORE.Status.blind",
    img: "icons/svg/blind.svg",
    order: 7,
  },
  invisible: {
    name: "EMOKLORE.Status.invisible",
    img: "icons/svg/invisible.svg",
    order: 8,
  },
} satisfies Record<string, StatusEffectConfig>;

export type StatusEffectKey = keyof typeof definitions;

// satisfies だけだと各値が個別の狭い型に推論されるため、値の型は StatusEffectConfig に揃える
export const statusEffects: Record<StatusEffectKey, StatusEffectConfig> = definitions;
