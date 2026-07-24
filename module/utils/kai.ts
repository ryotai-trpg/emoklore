/**
 * 怪異の攻撃カードの組み立て。
 *
 * カードを作る側（documents/actor の rollKaiAttack）が使う。ルール計算は
 * module/rules/kai-attack.ts が持つ。武器カードと違い育たない（判定とダメージを一度に
 * 振って1枚に出す）ので、状態の更新用の再描画は持たない。
 */

import { systemPath } from "../constants";

const CARD_TEMPLATE = systemPath("templates/chat/kai-attack-card.hbs");

/** カードの描画・保存に要る状態。ChatMessageサブタイプのスキーマと同じ形 */
export type KaiAttackCardState = {
  attackName: string;
  actorUuid: string | null;
  mpCost: number;
  judgeless: boolean;
  /** 判定の成功数。judgeless のときは固定成功数 */
  successCount: number | null;
  damageTotal: number | null;
};

/**
 * 怪異の攻撃カードのHTMLを組み立てる。
 *
 * 判定ロールとダメージロールを明示的に受ける。judgeless のときは判定ロールが無く、
 * ダメージ式が空ならダメージロールも無い。
 */
export async function renderKaiAttackCard(
  state: KaiAttackCardState,
  {
    judgmentRoll,
    damageRoll,
  }: { judgmentRoll: foundry.dice.Roll | null; damageRoll: foundry.dice.Roll | null },
): Promise<string> {
  return foundry.applications.handlebars.renderTemplate(CARD_TEMPLATE, {
    ...state,
    canApplyDamage: state.damageTotal !== null,
    judgmentHTML: judgmentRoll ? await judgmentRoll.render() : "",
    damageHTML: damageRoll ? await damageRoll.render() : "",
  });
}
