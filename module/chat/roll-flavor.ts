/**
 * 判定メッセージの見出し。
 *
 * 判定を振る側（`documents/`）とダイアログ（`applications/`）の両方から使うので、
 * どちらにも寄せずここに置く。
 */

import type { SkillRollContext } from "../data/character-like";
import { skillMarker } from "../utils/skill";

/**
 * チャットの見出しに出す判定名を組み立てる。「＊格闘」「★技能：専門」など。
 *
 * 基本技能は「＊」、エクストラ技能は「★」を頭に付けるのがシート表記の慣習。
 * 表示の話なのでルール層ではなく、チャットカードを作るこの層に置く。
 */
export function formatSkillName({
  label,
  isBase,
  isExtra,
  specialization,
}: SkillRollContext): string {
  const prefix = skillMarker(isBase, isExtra);
  const suffix = specialization
    ? `${game.i18n.localize("EMOKLORE.Common.colon")}${specialization}`
    : "";

  return `${prefix}${label}${suffix}`;
}

/** チャットの見出し。判定の種類によらず「〈○○〉判定」の形にする */
export const formatRollFlavor = (skillName: string): string =>
  game.i18n.localize("EMOKLORE.skillRoll", { skillName });
