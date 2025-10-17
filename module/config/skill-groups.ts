export interface SkillGroupsConfig {
  label: string;
}

export const skillGroups: Record<string, SkillGroupsConfig> = {
  investigation: {
    label: "EMOKLORE.Actor.skillGroup.investigation",
  },
  perception: {
    label: "EMOKLORE.Actor.skillGroup.perception",
  },
  negotiations: {
    label: "EMOKLORE.Actor.skillGroup.negotiations",
  },
  knowledge: {
    label: "EMOKLORE.Actor.skillGroup.knowledge",
  },
  athletic: {
    label: "EMOKLORE.Actor.skillGroup.athletic",
  },
  survival: {
    label: "EMOKLORE.Actor.skillGroup.survival",
  },
  unique: {
    label: "EMOKLORE.Actor.skillGroup.unique",
  },
} as const;
