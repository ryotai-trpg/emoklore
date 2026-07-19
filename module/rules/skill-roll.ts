import { formatDMPart } from "../utils/helper";
import type { ModifierSet, RollSpec } from "./types";

export type SkillRollParams = {
  /** 技能レベル。基本技能は常に1 */
  level: number;
  /** 修正前の目標値（prepareDerivedDataで算出済みのもの） */
  baseTarget: number;
  skillMod: ModifierSet;
  characteristicMod: ModifierSet;
  skillGroupMod: ModifierSet;
};

/**
 * 技能判定の内容を決める。
 *
 * 技能・能力値・技能グループの3系統の修正値を合算し、
 * ダイス数（レベル+ボーナス）と目標値（基準値+目標値修正）を出す。
 */
export function resolveSkillRoll({
  level,
  baseTarget,
  skillMod,
  characteristicMod,
  skillGroupMod,
}: SkillRollParams): RollSpec {
  const bonus = skillMod.bonus + characteristicMod.bonus + skillGroupMod.bonus;
  const targetMod = skillMod.target + characteristicMod.target + skillGroupMod.target;
  const successMod = skillMod.success + characteristicMod.success + skillGroupMod.success;

  return {
    diceCount: level + bonus,
    target: baseTarget + targetMod,
    successMod,
    dmFormula: `${formatDMPart(level, bonus)}DM≦${formatDMPart(baseTarget, targetMod)}`,
  };
}
