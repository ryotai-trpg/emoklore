import { formatDMPart, type ModifierSet, type RollSpec } from "./types";

/** 共鳴感情の一致度 */
export type ResonanceMatch = "none" | "root" | "completely";

export type ResonanceRollParams = {
  /** 現在の共鳴値 */
  resonanceValue: number;
  /** 判定の強度（目標値になる） */
  intensity: number;
  emotionMatch?: ResonanceMatch | undefined;
  /**
   * 共鳴判定に効く修正。〈∞共鳴〉への効果（残響「ハーモニー」）と、
   * DLが与えるダイスボーナスを合算したもの
   */
  mod: ModifierSet;
};

/**
 * ハウリング（極限共鳴）が起きる成功数の下限。
 *
 * ルールブックは「トリプル（極限成功）以上」と書く。成功数で持つのは、結果名が
 * 4〜9をすべてミラクルに潰すため（成功数の比較は `rules/success.ts` と同じ考え方）。
 */
export const HOWLING_SUCCESS = 3;

/**
 * 憑依判定で成功時に上がる〈∞共鳴〉の量。
 *
 * 共鳴判定と違い、上昇値の指定を受けず**成否によらず**1上がる。
 */
export const POSSESSION_RISE = 1;

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
 *
 * **一致度を先に効かせてからダイスボーナスを足す。** 順序を入れ替えると完全一致の
 * ダイス数が変わってしまう（共鳴値3にボーナス1なら、正しくは3×2+1=7で、
 * 先に足すと(3+1)×2=8になる）。倍率はレベルに掛かるもので、ボーナスは判定に足す
 * ものなので、掛ける相手にボーナスを混ぜない。
 */
export function resolveResonanceRoll({
  resonanceValue,
  intensity,
  emotionMatch,
  mod,
}: ResonanceRollParams): RollSpec {
  let diceCount = resonanceValue;

  if (emotionMatch === "root") {
    diceCount += 1;
  } else if (emotionMatch === "completely") {
    diceCount *= 2;
  }

  return {
    diceCount: diceCount + mod.bonus,
    target: intensity + mod.target,
    successMod: mod.success,
    dmFormula: `${formatDMPart(diceCount, mod.bonus)}DM≦${formatDMPart(intensity, mod.target)}`,
  };
}
