/**
 * 心肺停止者への〈＊生存〉判定リマインダの組み立て。
 *
 * 対象を並べ、各自に判定ショートカットを添えるところまで。判定の強制や【死亡】の
 * 自動付与はしない（`EmokloreCombat._onEndRound` から呼ばれる）。
 */

import { systemPath } from "../constants";
import type { SurvivalReminderState, SurvivalTarget } from "../data/messages/survival-reminder";
import { createCardMessage } from "./message";

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
    content: await foundry.applications.handlebars.renderTemplate(TEMPLATE, { targets }),
  });
}
