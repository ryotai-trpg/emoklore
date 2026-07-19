/** 出目がこれ以下ならクリティカルとして成功数がもう1つ増える */
export const CRITICAL_FACE = 1;

/** 出目がこれ以上ならファンブルとして成功数が1つ減る */
export const FUMBLE_FACE = 10;

export type ResultName =
  | "fumble"
  | "failure"
  | "single"
  | "double"
  | "triple"
  | "miracle"
  | "catastrophe";

/**
 * 出目の並びから成功数を数える。
 *
 * 目標値以下で1成功。加えて1はクリティカルとしてもう1成功、10はファンブルとして1減算する。
 * つまり目標値が1以上なら出目1は2カウントになる。
 */
export function countSuccesses(diceResults: number[], target: number): number {
  let successes = 0;

  for (const result of diceResults) {
    if (result <= target) successes += 1;
    if (result <= CRITICAL_FACE) successes += 1;
    if (result >= FUMBLE_FACE) successes -= 1;
  }

  return successes;
}

/**
 * 成功数から結果名を決める。`EMOKLORE.result.*` の言語キーに対応する。
 */
export function resolveResultName(successCount: number): ResultName {
  if (successCount < 0) return "fumble";
  if (successCount === 0) return "failure";
  if (successCount === 1) return "single";
  if (successCount === 2) return "double";
  if (successCount === 3) return "triple";
  if (successCount < 10) return "miracle";
  return "catastrophe";
}
