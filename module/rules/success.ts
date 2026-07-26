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
 * DLが判定に要求できる成功度。ルールブックの難易度の目安に対応する
 * （ダブル＝非常に難しい、トリプル＝極めて難しい、ミラクル＝奇跡でも不可能）。
 */
export type SuccessRequirement = "single" | "double" | "triple" | "miracle";

/** 要求を満たすのに要る成功数 */
const REQUIRED_SUCCESSES: Record<SuccessRequirement, number> = {
  single: 1,
  double: 2,
  triple: 3,
  miracle: 4,
};

/**
 * 選べる成功度の並び。難易度の目安の順に出す。
 *
 * 表から起こすので、要求を足したときに並びだけ書き忘れることがない
 */
export const SUCCESS_REQUIREMENTS = Object.keys(REQUIRED_SUCCESSES) as SuccessRequirement[];

/** 要求された成功度に要る成功数を返す */
export function requiredSuccesses(requirement: SuccessRequirement): number {
  return REQUIRED_SUCCESSES[requirement];
}

/**
 * 要求された成功数に届いたか。
 *
 * **結果名ではなく成功数で比べる。** `resolveResultName` は4〜9をすべて `miracle` に
 * 潰すので、名前で比べるとカタストロフ（10以上）がミラクル要求を満たさなくなる。
 */
export function meetsRequirement(successCount: number, required: number): boolean {
  return successCount >= required;
}

/**
 * 成功数から結果名を決める。`EMOKLORE.Result.*` の言語キーに対応する。
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
