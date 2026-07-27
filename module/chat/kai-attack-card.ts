/**
 * 怪異の攻撃カードの組み立て。
 *
 * 武器カードと同じく1枚のカードが育つので、作るときと書き足すときの両方でここを通る。
 * ルール計算は `rules/kai-attack.ts` が持つ。
 */

import { systemPath } from "../constants";
import { KaiDataModel } from "../data/kai";
import { type AttackRolls, flattenRolls } from "../data/messages/attack-card";
import type { CardMessage } from "../data/messages/card-model";
import {
  type KaiAttackCardState,
  resolveKaiAttackCardButtons,
} from "../data/messages/kai-attack-card";
import type { EmokloreActor } from "../documents/actor";
import { createCardMessage, updateCardMessage } from "./message";

const TEMPLATE = systemPath("templates/chat/kai-attack-card.hbs");

/**
 * 攻撃欄のラベル。
 *
 * 「判定なし」「消費MP」は**攻撃そのものの性質**なので、文字列はスキーマが持つ。
 * カードも怪異シートも同じところから引く。カードの名前空間に置くと、シート側が
 * そこへ借りに来ることになり、シートの文字列がチャットの側に居座る。
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

/**
 * ヘッダの補足に並べる断片。
 *
 * **まだ解決していないものだけを置く。** 判定を振れば `2DM≦7` はロールの式として、
 * ダメージを振れば `@successd4+3` は差し替え済みの式として、それぞれ下に出る。
 * ヘッダにも残すと同じものが1枚に二度出ることになる（Issue #110 と同じ形）。
 *
 * 判定なしの成功数だけは例外で、振るものが無く下に出る先が無いのでここに残す。
 */
const buildMetaParts = (state: KaiAttackCardState): string[] => {
  const labels = attackFieldLabels();
  const parts: string[] = [];

  if (state.judgeless) {
    parts.push(labels.judgeless);
    parts.push(`${_loc("EMOKLORE.ChatMessage.kaiAttack.SuccessCount")} ${state.successCount}`);
  } else if (state.successCount === null) {
    parts.push(`${state.diceCount}DM≦${state.target}`);
  }

  if (state.damageFormula !== "" && state.damageTotal === null) parts.push(state.damageFormula);
  if (state.mpCost) parts.push(`${labels.mpCost} ${state.mpCost}`);

  return parts;
};

/**
 * 怪異の攻撃カードのHTMLを組み立てる。
 *
 * 状態をモデルからではなく引数で受けるのは、更新の直前に「これから保存する状態」で
 * 描く必要があるため。カードを最初に作る時点ではモデルがまだ存在しないという事情もある。
 */
async function renderKaiAttackCard(
  state: KaiAttackCardState,
  { attackRoll, damageRoll }: AttackRolls,
): Promise<string> {
  return foundry.applications.handlebars.renderTemplate(TEMPLATE, {
    ...state,
    ...resolveKaiAttackCardButtons(state),
    metaParts: buildMetaParts(state),
    attackHTML: attackRoll ? await attackRoll.render() : "",
    damageHTML: damageRoll ? await damageRoll.render() : "",
  });
}

/**
 * 怪異の攻撃カードをチャットに流す。
 *
 * まだ何も振っていないので、ロールも空でダイス音も鳴らさない（武器カードと同じ）。
 */
export async function createKaiAttackMessage(
  actor: EmokloreActor,
  state: KaiAttackCardState,
): Promise<ChatMessage | undefined> {
  return createCardMessage({
    type: "kaiAttack",
    system: state,
    speaker: ChatMessage.getSpeaker({ actor }),
    content: await renderKaiAttackCard(state, {}),
  });
}

/** 振った結果をカードに書き戻して描き直す。当て方とダイス音は `chat/message.ts` が持つ */
export async function updateKaiAttackCard(
  message: CardMessage,
  system: KaiAttackCardState,
  rolls: AttackRolls,
): Promise<void> {
  await updateCardMessage(message, {
    content: await renderKaiAttackCard(system, rolls),
    rolls: flattenRolls(rolls),
    system,
  });
}
