/**
 * 怪異の攻撃カードのうち、怪異に固有のボタンのハンドラ。
 *
 * 判定を駆動するので `data/` には置かず、`emoklore.ts` の init から
 * `KaiAttackCardModel.ACTIONS` に登録する。ダメージ適用は武器カードと共通なので
 * `attack-card.ts` にある。
 *
 * どちらもアクターを引かない。ダイス数・判定値・ダメージ式はカードに焼き込んであるので、
 * 怪異を消したあとでも、攻撃欄を書き換えたあとでも、そのカードは出したときの内容で振れる。
 */

import { updateKaiAttackCard } from "../chat/kai-attack-card";
import type { AttackRolls } from "../data/messages/attack-card";
import type { KaiAttackCardModel, KaiAttackCardState } from "../data/messages/kai-attack-card";
import { EmokloreRoll } from "../dice/emoklore-roll";
import { buildKaiAttackSpec, substituteSuccess } from "../rules/kai-attack";

/** 判定を振り、同じカードに書き足す */
export async function rollKaiAttack(this: KaiAttackCardModel): Promise<void> {
  if (!this.buttons.canRollAttack) return;

  const spec = buildKaiAttackSpec({ diceCount: this.diceCount, target: this.target });
  const roll = EmokloreRoll.fromSpec(spec);
  await roll.evaluate();

  const rolls = { attackRoll: roll };
  await applyRoll(this, rolls, { successCount: roll.successCount });
}

/** ダメージを振り、同じカードに書き足す */
export async function rollKaiDamage(this: KaiAttackCardModel): Promise<void> {
  if (!this.buttons.canRollDamage) return;

  // canRollKaiDamage が成功数の非nullを保証している
  const formula = substituteSuccess(this.damageFormula, this.successCount as number);
  const roll = new foundry.dice.Roll(formula);
  await roll.evaluate();

  const rolls = { attackRoll: this.attackRoll, damageRoll: roll };
  await applyRoll(this, rolls, { damageTotal: roll.total ?? 0 });
}

/** ロールと状態をカードに書き戻す。描き直しとダイス音は chat/ 側が持つ */
async function applyRoll(
  card: KaiAttackCardModel,
  rolls: AttackRolls,
  changes: Partial<KaiAttackCardState>,
): Promise<void> {
  const system = { ...card.toObject(), ...changes } as KaiAttackCardState;

  await updateKaiAttackCard(card.message, system, rolls);
}
