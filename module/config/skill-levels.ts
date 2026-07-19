export interface SkillLevelConfig {
  label: string;
}

const definitions = {
  0: { label: "EMOKLORE.skillLevel.0" },
  1: { label: "EMOKLORE.skillLevel.1" },
  2: { label: "EMOKLORE.skillLevel.2" },
  3: { label: "EMOKLORE.skillLevel.3" },
} satisfies Record<number, SkillLevelConfig>;

export type SkillLevelKey = keyof typeof definitions;

// satisfies だけだと各値が個別の狭い型に推論されるため、値の型は SkillLevelConfig に揃える。
// キーは literal のまま保たれるので SkillLevelKey が使える
export const skillLevels: Record<SkillLevelKey, SkillLevelConfig> = definitions;
