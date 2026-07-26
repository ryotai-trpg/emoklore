/**
 * 怪異の攻撃カードの組み立て。
 *
 * 武器カードと違い育たない（判定とダメージを一度に振って1枚に出す）ので、状態の更新用の
 * 再描画は持たない。ルール計算は `rules/kai-attack.ts` が持つ。
 */

import { systemPath } from "../constants";
import { KaiDataModel } from "../data/kai";
import type { KaiAttackCardState } from "../data/messages/kai-attack-card";
import type { EmokloreActor } from "../documents/actor";
import { createCardMessage } from "./message";

const TEMPLATE = systemPath("templates/chat/kai-attack-card.hbs");

/**
 * 攻撃欄のラベル。
 *
 * 「判定なし」「消費MP」は**攻撃そのものの性質**なので、文字列はスキーマが持つ。
 * カードも怪異シートも同じところから引く（以前はシートがカードの名前空間へ借りに
 * 来ており、シートの文字列がチャットの側に置かれている状態だった）。
 *
 * ラベルは `i18nInit` の `localizeSchema` がスキーマに入れるので、ここでは読むだけでよい。
 */
const attackFieldLabels = (): { judgeless: string; mpCost: string } => {
  // getField は DataField 止まりで fields に降りられず、DataField の型にも label が出ない。
  // 要素のスキーマとして名乗り直す（context/character.ts の biography と同じ形）。
  // キーを実際に読む2つに絞ると、有限キーの Record として undefined 無しで引ける
  const { fields } = KaiDataModel.schema.getField(
    "attacks.element",
  ) as foundry.data.fields.SchemaField & {
    fields: Record<"judgeless" | "mpCost", { label: string }>;
  };

  return { judgeless: fields.judgeless.label, mpCost: fields.mpCost.label };
};

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
    attackLabels: attackFieldLabels(),
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
