export interface SkillLevelConfig {
  label: string;
}

export const skillLevels: Record<number, SkillLevelConfig> = {
  0: { label: "EMOKLORE.skillLevel.0" },
  1: { label: "EMOKLORE.skillLevel.1" },
  2: { label: "EMOKLORE.skillLevel.2" },
  3: { label: "EMOKLORE.skillLevel.3" },
} as const;
