/**
 * 共鳴判定の要求カードと結果カードの見せ方。
 *
 * `utils/request.ts` と同じ立ち位置で、保存データと `config/` の定義を合流させて
 * テンプレートに渡す形まで整える。判定を振るのは `applications/` の担当。
 */

import { systemPath } from "../constants";
import type { RequestTarget } from "../data/messages/resonance-request";
import { formatEmotions } from "./emotion";
import { resolveResonanceTable } from "./howling";

const REQUEST_TEMPLATE = systemPath("templates/chat/resonance-request.hbs");
const OUTCOME_TEMPLATE = systemPath("templates/chat/resonance-outcome.hbs");

/** 要求カードに焼き込む内容。ChatMessage のサブタイプのスキーマと同じ形 */
export type ResonanceRequestState = {
  intensity: number;
  rise: string;
  emotions: string[];
  forcedMatch: string;
  possessionMode: boolean;
  targets: RequestTarget[];
  kaiUuid: string | null;
};

/** 結果カードに焼き込む内容 */
export type ResonanceOutcomeState = {
  actorUuid: string | null;
  name: string;
  successCount: number;
  rise: number;
  before: number;
  after: number;
  howling: boolean;
  possessionReached: boolean;
  kaiUuid: string | null;
};

/** 共鳴判定の要求カードのHTMLを組み立てる */
export const renderResonanceRequestCard = (state: ResonanceRequestState): Promise<string> =>
  foundry.applications.handlebars.renderTemplate(REQUEST_TEMPLATE, {
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

/**
 * 共鳴判定の結果カードのHTMLを組み立てる。
 *
 * ハウリングを引くボタンは、怪異に共鳴表が紐づいているときだけ出す。押しても何も
 * 起きないボタンを並べるより、DLに「表を用意していない」と気付かせるほうがよい。
 */
export const renderResonanceOutcomeCard = async (state: ResonanceOutcomeState): Promise<string> => {
  const canDraw = state.howling && Boolean(await resolveResonanceTable(state.kaiUuid));

  return foundry.applications.handlebars.renderTemplate(OUTCOME_TEMPLATE, {
    line: game.i18n.localize(
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

/** 一致度のキーを言語キーの綴りに直す。`root` → `MatchRoot` */
const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);
