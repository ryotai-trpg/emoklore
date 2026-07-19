export interface SkillGroupsConfig {
  label: string;
}

const definitions = {
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
} satisfies Record<string, SkillGroupsConfig>;

export type SkillGroupKey = keyof typeof definitions;

// satisfies だけだと各値が個別の狭い型に推論されるため、値の型は SkillGroupsConfig に揃える。
// キーは literal のまま保たれるので SkillGroupKey が使える
export const skillGroups: Record<SkillGroupKey, SkillGroupsConfig> = definitions;
