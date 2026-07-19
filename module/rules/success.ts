/** 出目がこれ以下ならクリティカル。目標値によらず成功し、さらに成功数がもう1つ増える */
export const CRITICAL_FACE = 1;

/** 出目がこれ以上ならファンブル。目標値によらず失敗し、成功数が1つ減る */
export const FUMBLE_FACE = 10;

/** 出目1個の判定結果 */
export type FaceOutcome = "critical" | "success" | "failure" | "fumble";

/** 出目1個が成功数に与える増減 */
const FACE_POINTS: Record<FaceOutcome, number> = {
  critical: 2,
  success: 1,
  failure: 0,
  fumble: -1,
};

export type ResultName =
  | "fumble"
  | "failure"
  | "single"
  | "double"
  | "triple"
  | "miracle"
  | "catastrophe";

/**
 * 出目1個の判定結果を決める。
 *
 * クリティカルとファンブルは目標値より優先する。目標値が10以上でも出目10はファンブルで、
 * 目標値が0以下でも出目1はクリティカルになる。
 */
export function classifyFace(face: number, target: number): FaceOutcome {
  if (face >= FUMBLE_FACE) return "fumble";
  if (face <= CRITICAL_FACE) return "critical";
  return face <= target ? "success" : "failure";
}

/** 判定結果が成功数に与える増減を返す */
export function facePoints(outcome: FaceOutcome): number {
  return FACE_POINTS[outcome];
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
