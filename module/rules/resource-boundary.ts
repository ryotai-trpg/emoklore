/**
 * HP/MPが境界をまたいだときに出す案内の種別。
 *
 * ルールブック「HPとMP」の境界処理は多段だが、ここでは「どの案内を出すか」だけを
 * 決める。判定の強制や状態の自動付与はしない（docs/roadmap.md「実装しないこと」）。
 */

export type HpBoundary = "cardiacArrest" | "unconsciousCheck" | null;

/**
 * HPの境界。0以下で【心肺停止】、一度に現在HPの半分以上を失うと気絶判定。
 *
 * 0まで落ちたときは気絶判定の案内を出さない。【心肺停止】が優先で、気絶を
 * 尋ねる意味が無くなるため。既に0以下だった対象は、新しく境界をまたいでいない。
 */
export function resolveHpBoundary({
  before,
  after,
}: {
  before: number;
  after: number;
}): HpBoundary {
  if (before <= 0) return null;
  if (after <= 0) return "cardiacArrest";

  return (before - after) * 2 >= before ? "unconsciousCheck" : null;
}

export type MpBoundary = "faintCheck" | null;

/**
 * MPの境界。0以下になったら〈＊自我〉判定（成功でMP1、失敗で【失神】）の案内を出す。
 *
 * 既に0以下だった対象は、新しく境界をまたいでいない。
 */
export function resolveMpBoundary({
  before,
  after,
}: {
  before: number;
  after: number;
}): MpBoundary {
  return before > 0 && after <= 0 ? "faintCheck" : null;
}
