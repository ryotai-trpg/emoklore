export interface CharacteristicConfig {
  label: string;
  fa: string;
}

export const characteristics: Record<string, CharacteristicConfig> = {
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
} as const;
