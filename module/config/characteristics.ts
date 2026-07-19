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
