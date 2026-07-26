/**
 * 心肺停止者への〈＊生存〉判定リマインダの組み立て。
 *
 * 対象を並べ、各自に判定ショートカットを添えるところまで。判定の強制や【死亡】の
 * 自動付与はしない（`EmokloreCombat._onEndRound` から呼ばれる）。
 */

import { systemPath } from "../constants";
import type { SurvivalReminderState, SurvivalTarget } from "../data/messages/survival-reminder";
import { describeSkillLabel } from "../utils/skill";
import { createCardMessage } from "./message";
import { formatRollFlavor } from "./roll-flavor";

const TEMPLATE = systemPath("templates/chat/survival-reminder.hbs");

/** ラウンド終了時のリマインダをチャットに流す */
export async function createSurvivalReminderMessage(
  targets: SurvivalTarget[],
  round: number,
): Promise<ChatMessage | undefined> {
  const system: SurvivalReminderState = { round, targets };

  return createCardMessage({
    type: "survivalReminder",
    system,
    content: await foundry.applications.handlebars.renderTemplate(TEMPLATE, {
      targets,
      // ボタンの文字を訳文に持たせない。基本技能の印（＊）を落とした「〈生存〉判定」に
      // なりやすく、同じカードの本文（〈＊生存〉）と食い違う。技能名の見せ方は
      // describeSkillLabel が1箇所で決める
      rollLabel: formatRollFlavor(
        describeSkillLabel({ kind: "base", key: "survival" }).markedLabel,
      ),
    }),
  });
}
