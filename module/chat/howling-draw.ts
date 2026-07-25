/**
 * 共鳴表から引いた結果カードの組み立て。
 *
 * 引いた結果を誰に適用するかは `applications/howling.ts` の担当。表を引くところ
 * （`resolveResonanceTable`）は `utils/howling.ts` にある。
 */

import type { HowlingCategory } from "../config/howling-categories";
import { systemPath } from "../constants";
import type { HowlingDrawState } from "../data/messages/howling-draw";
import type { EmokloreActor } from "../documents/actor";
import { localizeHowlingCategory, type TableResult } from "../utils/howling";
import { formatSkillRefs } from "../utils/skill";
import { createCardMessage } from "./message";

const TEMPLATE = systemPath("templates/chat/howling-draw.hbs");

/** 反応アイテムのうち、カードに写すぶんだけ */
type HowlingReaction = {
  name?: string;
  img?: string;
  type?: string;
  system?: {
    category: HowlingCategory;
    effect: string;
    recovery: { note: string; skills: Set<string> };
  };
};

/**
 * 引いた結果を、カードに焼き込む形へ写す。
 *
 * document結果なら参照先の反応アイテムから、text結果なら結果そのものから読む。
 * **アイテムが消えたあとでもカードが読めるよう、表示に要る値は焼き込む**（武器カードと同じ）。
 */
export const buildHowlingDrawState = async (
  result: TableResult,
  context: { actorUuid: string | null; name: string; kaiUuid: string | null; tableUuid: string },
): Promise<HowlingDrawState> => {
  const base: HowlingDrawState = {
    ...context,
    reactionName: result.name,
    reactionImg: result.img ?? "",
    category: "",
    description: result.description,
    recoverySkills: "",
    recoveryNote: "",
    itemUuid: null,
  };

  if (result.type !== "document" || !result.documentUuid) return base;

  const item = (await foundry.utils.fromUuid(result.documentUuid)) as HowlingReaction | null;

  // 反応アイテム以外を指している表もありうる（GMが自分で組むため）。その場合は
  // リンクとして名前だけ出し、適用のボタンは出さない
  if (item?.type !== "howling" || !item.system) return base;

  return {
    ...base,
    reactionName: item.name || result.name,
    reactionImg: item.img || base.reactionImg,
    category: item.system.category,
    description: item.system.effect || result.description,
    recoverySkills: formatSkillRefs(item.system.recovery.skills),
    recoveryNote: item.system.recovery.note,
    itemUuid: result.documentUuid,
  };
};

/** 引いた結果カードのHTMLを組み立てる */
export const renderHowlingDrawCard = async (state: HowlingDrawState): Promise<string> =>
  foundry.applications.handlebars.renderTemplate(TEMPLATE, {
    reactionName: state.reactionName,
    reactionImg: state.reactionImg,
    categoryLabel: state.category ? localizeHowlingCategory(state.category) : "",
    descriptionHTML: await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      state.description,
    ),
    recoverySkills: state.recoverySkills,
    recoveryNote: state.recoveryNote,
    // 反応アイテムを指していない結果は適用しようがないので、ボタンごと出さない
    canApply: Boolean(state.itemUuid && state.actorUuid),
  });

/**
 * 共鳴表から引いた反応をチャットに流す。
 *
 * 引いた 1D6 をメッセージに載せるので、ダイスの演出も判定と同じように出る。発言者を
 * 共鳴者にするのは結果カードと同じ理由で、誰のハウリングかが並びだけで分かるようにするため。
 */
export async function createHowlingDrawMessage(
  state: HowlingDrawState,
  roll: foundry.dice.Roll | null,
  actor: EmokloreActor | null,
): Promise<ChatMessage | undefined> {
  return createCardMessage({
    type: "howlingDraw",
    system: state,
    content: await renderHowlingDrawCard(state),
    rolls: roll ? [roll] : [],
    sound: roll ? CONFIG.sounds.dice : null,
    speaker: actor ? ChatMessage.getSpeaker({ actor }) : undefined,
  });
}
