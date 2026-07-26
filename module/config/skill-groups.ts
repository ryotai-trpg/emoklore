export interface SkillGroupConfig {
  label: string;
}

const definitions = {
  investigation: {
    label: "EMOKLORE.Config.skillGroups.investigation",
  },
  perception: {
    label: "EMOKLORE.Config.skillGroups.perception",
  },
  negotiations: {
    label: "EMOKLORE.Config.skillGroups.negotiations",
  },
  knowledge: {
    label: "EMOKLORE.Config.skillGroups.knowledge",
  },
  athletic: {
    label: "EMOKLORE.Config.skillGroups.athletic",
  },
  survival: {
    label: "EMOKLORE.Config.skillGroups.survival",
  },
  unique: {
    label: "EMOKLORE.Config.skillGroups.unique",
  },
} satisfies Record<string, SkillGroupConfig>;

export type SkillGroupKey = keyof typeof definitions;

// satisfies だけだと各値が個別の狭い型に推論されるため、値の型は SkillGroupConfig に揃える。
// キーは literal のまま保たれるので SkillGroupKey が使える
export const skillGroups: Record<SkillGroupKey, SkillGroupConfig> = definitions;

/** 技能グループキーかどうか。保存データから来た文字列を絞るときに通す */
export const isSkillGroupKey = (value: string): value is SkillGroupKey => value in definitions;

/**
 * スキーマの choices に渡す表。値はi18nキー（characteristicChoices と同じ理由）。
 *
 * カスタム技能はグループを持たないこともあるので、空文字は choices に含めず
 * StringField 側で blank を許す形にしている
 */
export const skillGroupChoices: Record<string, string> = Object.fromEntries(
  Object.entries(definitions).map(([key, { label }]) => [key, label]),
);
