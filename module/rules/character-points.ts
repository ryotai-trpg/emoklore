/** 技能レベルごとの取得コスト。レベル0は取得していない扱いでコストなし */
export const SKILL_POINT_COSTS: Record<number, number> = {
  1: 1,
  2: 5,
  3: 15,
};

/** 能力値ポイントの計算から除外される能力値（運勢は他とは別枠のため） */
const EXCLUDED_FROM_CHARACTERISTIC_POINTS = "fortune";

type LeveledSkill = { level: number };
type CharacteristicValues = Record<string, { value: number }>;

/**
 * 技能リストの合計コストを求める。
 */
export function calculateSkillPoints(skills: LeveledSkill[]): number {
  return Object.entries(SKILL_POINT_COSTS).reduce((sum, [level, cost]) => {
    const count = skills.filter((skill) => skill.level === Number.parseInt(level, 10)).length;
    return sum + count * cost;
  }, 0);
}

/**
 * 通常技能とエクストラ技能を合わせた消費ポイントを求める。
 *
 * 呼び出し側はエクストラ技能を `skills` にも含めたうえで `exSkills` にも渡す。
 * 結果としてエクストラ技能は2回数えられ、コストが2倍になる。
 */
export function calculateTotalSkillPoints(
  skills: LeveledSkill[],
  exSkills: LeveledSkill[],
): number {
  return calculateSkillPoints(skills) + calculateSkillPoints(exSkills);
}

/**
 * すべての能力値の合計。運勢も含む。
 */
export function calculateCharacteristicPoints(characteristics: CharacteristicValues): number {
  return Object.values(characteristics).reduce((sum, { value }) => sum + value, 0);
}

/**
 * 能力値ポイントの消費量。運勢は別枠なので合計から除く。
 */
export function calculateCharPointSum(characteristics: CharacteristicValues): number {
  const fortune = characteristics[EXCLUDED_FROM_CHARACTERISTIC_POINTS]?.value ?? 0;
  return calculateCharacteristicPoints(characteristics) - fortune;
}
