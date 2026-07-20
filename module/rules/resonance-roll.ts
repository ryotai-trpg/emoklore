import type { RollSpec } from "./types";

/** 共鳴感情の一致度 */
export type ResonanceMatch = "none" | "root" | "completely";

export type ResonanceRollParams = {
  /** 現在の共鳴値 */
  resonanceValue: number;
  /** 判定の強度（目標値になる） */
  intensity: number;
  emotionMatch?: ResonanceMatch | undefined;
};

/**
 * 強度の入力値を有効な範囲に丸める。
 *
 * 未入力・数値でない・0以下はすべて1として扱う。
 */
export function normalizeIntensity(value: number): number {
  return Number.isNaN(value) || value <= 0 ? 1 : value;
}

/**
 * 共鳴判定の内容を決める。
 *
 * 共鳴値がそのままダイス数になり、ルーツ属性一致で+1、完全一致で2倍になる。
 */
export function resolveResonanceRoll({
  resonanceValue,
  intensity,
  emotionMatch,
}: ResonanceRollParams): RollSpec {
  let diceCount = resonanceValue;

  if (emotionMatch === "root") {
    diceCount += 1;
  } else if (emotionMatch === "completely") {
    diceCount *= 2;
  }

  return {
    diceCount,
    target: intensity,
    successMod: 0,
    dmFormula: `${diceCount}DM≦${intensity}`,
  };
}
