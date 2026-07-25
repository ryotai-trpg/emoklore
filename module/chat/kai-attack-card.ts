/**
 * 怪異の攻撃カードの組み立て。
 *
 * 武器カードと違い育たない（判定とダメージを一度に振って1枚に出す）ので、状態の更新用の
 * 再描画は持たない。ルール計算は `rules/kai-attack.ts` が持つ。
 */

import { systemPath } from "../constants";
import type { KaiAttackCardState } from "../data/messages/kai-attack-card";
import type { EmokloreActor } from "../documents/actor";
import { createCardMessage } from "./message";

const TEMPLATE = systemPath("templates/chat/kai-attack-card.hbs");

/** カードに載るロール。judgeless なら判定が無く、ダメージ式が空ならダメージが無い */
export type KaiAttackRolls = {
  judgmentRoll: foundry.dice.Roll | null;
  damageRoll: foundry.dice.Roll | null;
};

/** 怪異の攻撃カードのHTMLを組み立てる */
export async function renderKaiAttackCard(
  state: KaiAttackCardState,
  { judgmentRoll, damageRoll }: KaiAttackRolls,
): Promise<string> {
  return foundry.applications.handlebars.renderTemplate(TEMPLATE, {
    ...state,
    canApplyDamage: state.damageTotal !== null,
    judgmentHTML: judgmentRoll ? await judgmentRoll.render() : "",
    damageHTML: damageRoll ? await damageRoll.render() : "",
  });
}

/** 怪異の攻撃カードをチャットに流す */
export async function createKaiAttackMessage(
  actor: EmokloreActor,
  state: KaiAttackCardState,
  rolls: KaiAttackRolls,
): Promise<ChatMessage | undefined> {
  return createCardMessage({
    type: "kaiAttack",
    system: state,
    speaker: ChatMessage.getSpeaker({ actor }),
    // 振らなかったぶんはメッセージに載せない
    rolls: [rolls.judgmentRoll, rolls.damageRoll].filter(
      (roll): roll is foundry.dice.Roll => roll !== null,
    ),
    content: await renderKaiAttackCard(state, rolls),
    sound: CONFIG.sounds.dice,
  });
}
