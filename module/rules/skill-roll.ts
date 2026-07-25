import { formatDMPart, type ModifierSet, type RollSpec, sumModifiers } from "./types";

export type SkillRollParams = {
  /** 技能レベル。基本技能は常に1 */
  level: number;
  /** 修正前の目標値（prepareDerivedDataで算出済みのもの） */
  baseTarget: number;
  skillMod: ModifierSet;
  characteristicMod: ModifierSet;
  skillGroupMod: ModifierSet;
  /** 判定すべてに効く修正。「全ての技能は判定値-2される」のような、範囲で切れないもの */
  globalMod: ModifierSet;
  /**
   * その場かぎりの修正。ダイスボーナス・成功数修正・判定値修正をここから入れる。
   *
   * 他の4系統がアクターに保存された効果の着地点なのに対し、これは判定のたびに
   * 呼び出し側が組む。効かない場合も `NO_MODIFIER` を渡す（`skillGroupMod` と同じ扱い）
   */
  situationalMod: ModifierSet;
};

/**
 * 技能判定の内容を決める。
 *
 * 技能・能力値・技能グループ・全体・その場の5系統の修正値を合算し、
 * ダイス数（レベル+ボーナス）と目標値（基準値+目標値修正）を出す。
 */
export function resolveSkillRoll({
  level,
  baseTarget,
  skillMod,
  characteristicMod,
  skillGroupMod,
  globalMod,
  situationalMod,
}: SkillRollParams): RollSpec {
  const {
    bonus,
    target: targetMod,
    success: successMod,
  } = sumModifiers(skillMod, characteristicMod, skillGroupMod, globalMod, situationalMod);

  return {
    diceCount: level + bonus,
    target: baseTarget + targetMod,
    successMod,
    dmFormula: `${formatDMPart(level, bonus)}DM≦${formatDMPart(baseTarget, targetMod)}`,
  };
}
