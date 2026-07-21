export interface SkillGroupConfig {
  label: string;
}

const definitions = {
  investigation: {
    label: "EMOKLORE.Actor.skillGroups.investigation",
  },
  perception: {
    label: "EMOKLORE.Actor.skillGroups.perception",
  },
  negotiations: {
    label: "EMOKLORE.Actor.skillGroups.negotiations",
  },
  knowledge: {
    label: "EMOKLORE.Actor.skillGroups.knowledge",
  },
  athletic: {
    label: "EMOKLORE.Actor.skillGroups.athletic",
  },
  survival: {
    label: "EMOKLORE.Actor.skillGroups.survival",
  },
  unique: {
    label: "EMOKLORE.Actor.skillGroups.unique",
  },
} satisfies Record<string, SkillGroupConfig>;

export type SkillGroupKey = keyof typeof definitions;

// satisfies だけだと各値が個別の狭い型に推論されるため、値の型は SkillGroupConfig に揃える。
// キーは literal のまま保たれるので SkillGroupKey が使える
export const skillGroups: Record<SkillGroupKey, SkillGroupConfig> = definitions;
