/**
 * DLからの共鳴判定・憑依判定の要求カードの組み立て。
 *
 * 判定要求カードと同じく出したら変わらない。各共鳴者の結果は別のメッセージになる。
 * 判定を振るのは `applications/requests.ts` の担当。
 */

import { systemPath } from "../constants";
import type { ResonanceRequestState } from "../data/messages/resonance-request";
import type { ResonanceMatch } from "../rules/resonance-roll";
import { formatEmotions } from "../utils/emotion";
import { createCardMessage } from "./message";

const TEMPLATE = systemPath("templates/chat/resonance-request.hbs");

/**
 * 一致度の表示に使うキー。
 *
 * 値を大文字化してキーを作ると、綴りが実行時にしか決まらず静的に追えない。
 * 表にしておけば check:i18n が参照として拾える
 */
const MATCH_LABELS: Record<ResonanceMatch, string> = {
  none: "EMOKLORE.Resonance.MatchNone",
  root: "EMOKLORE.Resonance.MatchRoot",
  completely: "EMOKLORE.Resonance.MatchCompletely",
};

/** 保存データ由来の文字列なので、引く前に絞る。空文字ならDLが強制していない */
const isResonanceMatch = (value: string): value is ResonanceMatch => value in MATCH_LABELS;

/** DLが強制した一致度の表示。強制していなければ空文字 */
const formatForcedMatch = (forcedMatch: string): string =>
  isResonanceMatch(forcedMatch) ? game.i18n.localize(MATCH_LABELS[forcedMatch]) : "";

/** 共鳴判定の要求カードのHTMLを組み立てる */
export const renderResonanceRequestCard = (state: ResonanceRequestState): Promise<string> =>
  foundry.applications.handlebars.renderTemplate(TEMPLATE, {
    intensity: state.intensity,
    // 憑依判定は上昇値の指定を受けない（成否によらず+1）ので、そもそも出さない
    rise: state.possessionMode ? "" : state.rise,
    emotions: formatEmotions(state.emotions),
    forcedMatch: formatForcedMatch(state.forcedMatch),
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
