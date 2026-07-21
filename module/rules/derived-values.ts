/** HP最大値の基礎値。ここに身体を足したものが最大HPになる */
export const HP_BASE = 10;

/** 共鳴値の下限。判定でダイス数になるので0以下にはならない */
export const RESONANCE_MIN = 1;

/** 目標値が能力値の半分（切り上げ）になる基本技能。〈手当〉だけが該当する */
const HALVED_TARGET_BASE_SKILL = "treatment";

/** 〈手当〉の目標値を出すときに能力値を割る数 */
const HALVED_TARGET_DIVISOR = 2;

/**
 * 技能の目標値。技能レベルに、紐づく能力値を足す。
 */
export function calculateSkillTarget(level: number, characteristicValue: number): number {
  return level + characteristicValue;
}

/**
 * 基本技能の目標値。
 *
 * 能力値がそのまま目標値になるが、〈手当〉だけは半分（切り上げ）になる。
 * 半分にする判断をここに閉じ込めているので、呼び出し側は基本技能を一律に回すだけでよい。
 */
export function calculateBaseSkillTarget(key: string, characteristicValue: number): number {
  return key === HALVED_TARGET_BASE_SKILL
    ? Math.ceil(characteristicValue / HALVED_TARGET_DIVISOR)
    : characteristicValue;
}

/**
 * カスタム技能の判定に使うレベル。
 *
 * ベース技能はレベルという概念を持たず、判定のダイス数は常に1になる。組込の基本技能が
 * スキーマで `min: 1, max: 1` に固定しているのと同じ扱いを、区分を値で持つカスタム技能では
 * 読む側で行う（Itemのスキーマは全インスタンス共通なので、区分ごとに範囲を変えられない）。
 */
export function calculateCustomSkillLevel(isBase: boolean, level: number): number {
  return isBase ? 1 : level;
}

/**
 * カスタム技能の目標値。
 *
 * ベース技能は能力値がそのまま目標値になり、それ以外は技能レベルを足す。組込の基本技能に
 * ある〈手当〉の半減のような技能ごとの例外は持たない（区分しか持たないため表現できない）。
 */
export function calculateCustomSkillTarget(
  isBase: boolean,
  level: number,
  characteristicValue: number,
): number {
  return isBase
    ? characteristicValue
    : calculateSkillTarget(calculateCustomSkillLevel(isBase, level), characteristicValue);
}

/**
 * HP最大値。基礎値に身体を足す。
 */
export function calculateMaxHp(physical: number): number {
  return HP_BASE + physical;
}

/**
 * MP最大値。精神と知力の合計。
 */
export function calculateMaxMp(mentality: number, intelligence: number): number {
  return mentality + intelligence;
}

/**
 * 共鳴値を下限に丸める。
 */
export function normalizeResonance(value: number): number {
  return Math.max(value, RESONANCE_MIN);
}

/**
 * 行動値。身体に〈速度〉の技能レベルを足す。
 */
export function calculateInitiative(physical: number, speedLevel: number): number {
  return physical + speedLevel;
}

/**
 * 現在値が最大値を超えていたら最大値に丸める。
 *
 * 能力値が下がって最大値が縮んだときに、現在値だけが取り残されるのを防ぐ。
 */
export function clampToMax(value: number, max: number): number {
  return Math.min(value, max);
}
