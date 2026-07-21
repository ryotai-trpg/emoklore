import type { ModifierSet, RollSpec } from "./types";

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
};

/**
 * 技能判定の内容を決める。
 *
 * 技能・能力値・技能グループ・全体の4系統の修正値を合算し、
 * ダイス数（レベル+ボーナス）と目標値（基準値+目標値修正）を出す。
 */
export function resolveSkillRoll({
  level,
  baseTarget,
  skillMod,
  characteristicMod,
  skillGroupMod,
  globalMod,
}: SkillRollParams): RollSpec {
  const mods = [skillMod, characteristicMod, skillGroupMod, globalMod];
  const sum = (pick: (mod: ModifierSet) => number) =>
    mods.reduce((total, mod) => total + pick(mod), 0);

  const bonus = sum((mod) => mod.bonus);
  const targetMod = sum((mod) => mod.target);
  const successMod = sum((mod) => mod.success);

  return {
    diceCount: level + bonus,
    target: baseTarget + targetMod,
    successMod,
    dmFormula: `${formatDMPart(level, bonus)}DM≦${formatDMPart(baseTarget, targetMod)}`,
  };
}

/**
 * DM式の一項を組み立てる。修正がなければ基準値だけ、あれば括弧でくくって符号を添える。
 *
 * 「2DM≦6」「(2+6)DM≦(5-2)」のように、判定の内訳が読み取れる形にするためのもの。
 * 式の見せ方は判定ルールの一部なのでこの層に置く。
 */
export function formatDMPart(base: number, modifier: number): string {
  if (!modifier) return `${base}`;
  const sign = modifier > 0 ? `+${modifier}` : modifier;
  return `(${base}${sign})`;
}
