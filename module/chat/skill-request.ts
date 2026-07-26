/**
 * DLからの判定要求カードの組み立て。
 *
 * 出したら変わらないカードなので、状態は作成時に焼き込むだけ。各PLの判定結果は
 * 別のメッセージとして出る（カードはPLから更新できない）。判定を振るのは
 * `applications/requests.ts` の担当。
 */

import { isBaseSkillKey } from "../config/base-skills";
import { isSkillKey } from "../config/skills";
import { systemPath } from "../constants";
import type { RequestedSkill, SkillRequestState } from "../data/messages/skill-request";
import { describeSkillLabel, formatRequirement } from "../utils/skill";
import { createCardMessage } from "./message";

const TEMPLATE = systemPath("templates/chat/skill-request.hbs");

/** カードに並べる技能1つぶん。`kind` と `key` はボタンの dataset に載せる */
export type RequestedSkillRow = RequestedSkill & { label: string };

/**
 * 要求された技能の表示名を引く。「＊知覚」「★霊感」のように印を頭に付ける。
 *
 * 保存データのキーは型を裏切りうるので、CONFIG を引く前に型述語を通す。引けない
 * キーはキーそのものを出す。黙って行を落とすと、DLの指定が消えたのか元から
 * 無かったのかが卓から見て分からなくなる。
 */
const describeRequestedSkill = ({ kind, key }: RequestedSkill): RequestedSkillRow => {
  if (kind === "base" && isBaseSkillKey(key)) {
    return { kind, key, label: describeSkillLabel({ kind, key }).markedLabel };
  }

  if (kind === "skill" && isSkillKey(key)) {
    return { kind, key, label: describeSkillLabel({ kind, key }).markedLabel };
  }

  return { kind, key, label: key };
};

/** 判定要求カードのHTMLを組み立てる */
const renderSkillRequestCard = (state: SkillRequestState): Promise<string> =>
  foundry.applications.handlebars.renderTemplate(TEMPLATE, {
    skills: state.skills.map(describeRequestedSkill),
    requirement: formatRequirement(state.requiredSuccess),
    bonus: state.bonus,
    successMod: state.successMod,
    note: state.note,
  });

/** DLからの判定要求をチャットに流す */
export async function createSkillRequestMessage(
  request: SkillRequestState,
): Promise<ChatMessage | undefined> {
  return createCardMessage({
    type: "skillRequest",
    system: request,
    content: await renderSkillRequestCard(request),
  });
}
