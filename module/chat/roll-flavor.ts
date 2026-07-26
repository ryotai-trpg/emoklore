/**
 * 判定メッセージの見出し。
 *
 * 判定を振る側（`documents/`）とダイアログ（`applications/`）の両方から使うので、
 * どちらにも寄せずここに置く。
 */

import type { SkillRollContext } from "../data/character-like";
import { describeSkillLabel } from "../utils/skill";

/**
 * チャットの見出しに出す判定名を組み立てる。「★技能：専門」など。
 *
 * 印と分野の組み立ては `describeSkillLabel` が決める。判定の文脈は組込・基本・カスタムの
 * どれでも同じ形（表示名と区分）に均されているので、カスタムとして渡す。
 */
export function formatSkillName({
  label,
  isBase,
  isExtra,
  specialization,
}: SkillRollContext): string {
  return describeSkillLabel({ kind: "custom", label, isBase, isExtra, specialization })
    .displayLabel;
}

/** チャットの見出し。判定の種類によらず「〈○○〉判定」の形にする */
export const formatRollFlavor = (skillName: string): string =>
  _loc("EMOKLORE.Format.skillRoll", { skillName });

/**
 * 共鳴判定の判定名。
 *
 * 技能の表に載らない特別な判定なので、`describeSkillLabel` を通らない。
 * 判定を振る側とダイアログの見出しの両方が要るので、ここに1つ置く。
 */
export const resonanceSkillName = (): string => _loc("EMOKLORE.Resonance.Name");
