/**
 * DLからの共鳴判定・憑依判定の要求カードの組み立て。
 *
 * 判定要求カードと同じく出したら変わらない。各共鳴者の結果は別のメッセージになる。
 * 判定を振るのは `applications/requests.ts` の担当。
 */

import { systemPath } from "../constants";
import type { ResonanceRequestState } from "../data/messages/resonance-request";
import { formatEmotions } from "../utils/emotion";
import { createCardMessage } from "./message";

const TEMPLATE = systemPath("templates/chat/resonance-request.hbs");

/** 一致度のキーを言語キーの綴りに直す。`root` → `MatchRoot` */
const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

/** 共鳴判定の要求カードのHTMLを組み立てる */
export const renderResonanceRequestCard = (state: ResonanceRequestState): Promise<string> =>
  foundry.applications.handlebars.renderTemplate(TEMPLATE, {
    intensity: state.intensity,
    // 憑依判定は上昇値の指定を受けない（成否によらず+1）ので、そもそも出さない
    rise: state.possessionMode ? "" : state.rise,
    emotions: formatEmotions(state.emotions),
    forcedMatch: state.forcedMatch
      ? game.i18n.localize(`EMOKLORE.Resonance.Match${capitalize(state.forcedMatch)}`)
      : "",
    possessionMode: state.possessionMode,
    targets: state.targets.map((target) => target.name).join("、"),
  });

/** DLからの共鳴判定・憑依判定の要求をチャットに流す */
export async function createResonanceRequestMessage(
  request: ResonanceRequestState,
): Promise<ChatMessage | undefined> {
  return createCardMessage({
    type: "resonanceRequest",
    system: request,
    content: await renderResonanceRequestCard(request),
  });
}
