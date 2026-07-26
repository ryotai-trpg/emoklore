/**
 * 共鳴判定のあと始末カードの組み立て。〈∞共鳴〉の変化とハウリングの発生。
 *
 * 発言者を振った共鳴者にするのは、DLが1回の操作で複数人ぶん振ったときに、
 * どの結果が誰のものかがチャットの並びだけで分かるようにするため。
 */

import { systemPath } from "../constants";
import type { ResonanceOutcomeState } from "../data/messages/resonance-outcome";
import type { EmokloreActor } from "../documents/actor";
import { resolveResonanceTable } from "../utils/howling";
import { createCardMessage } from "./message";

const TEMPLATE = systemPath("templates/chat/resonance-outcome.hbs");

/**
 * 共鳴判定の結果カードのHTMLを組み立てる。
 *
 * ハウリングを引くボタンは、怪異に共鳴表が紐づいているときだけ出す。押しても何も
 * 起きないボタンを並べるより、DLに「表を用意していない」と気付かせるほうがよい。
 */
const renderResonanceOutcomeCard = async (state: ResonanceOutcomeState): Promise<string> => {
  const canDraw = state.howling && Boolean(await resolveResonanceTable(state.kaiUuid));

  return foundry.applications.handlebars.renderTemplate(TEMPLATE, {
    line: _loc(
      state.rise > 0
        ? "EMOKLORE.ChatMessage.resonanceOutcome.Raised"
        : "EMOKLORE.ChatMessage.resonanceOutcome.Unchanged",
      { name: state.name, before: state.before, after: state.after, rise: state.rise },
    ),
    howling: state.howling,
    canDraw,
    possessionReached: state.possessionReached,
  });
};

/** 共鳴判定のあと始末をチャットに流す */
export async function createResonanceOutcomeMessage(
  actor: EmokloreActor,
  outcome: ResonanceOutcomeState,
): Promise<ChatMessage | undefined> {
  return createCardMessage({
    type: "resonanceOutcome",
    system: outcome,
    speaker: ChatMessage.getSpeaker({ actor }),
    content: await renderResonanceOutcomeCard(outcome),
  });
}
