/**
 * 攻撃カードのうち、ダメージ適用のボタンのハンドラ。
 *
 * 武器カードも怪異の攻撃カードも、振ったダメージの当て方は同じ（押した瞬間のターゲットへ、
 * そのままか軽減を尋ねてから）。読むのは `damageTotal` と `successCount` だけなので、
 * `AttackCardModel` に束ねて2枚で共有する。
 *
 * `applications/damage.ts` には置かない。あちらは「対象が決まったあとの後段」を持つ場所で、
 * 対象の集め方を決めるここは前段になる。登録は `emoklore.ts` の init が各カードの
 * `ACTIONS` へ行う（`data/` から `documents/` への逆依存を作らないため）。
 */

import type { AttackCardModel } from "../data/messages/attack-card";
import { applyDamageAndReport, requireTargets } from "./damage";
import { promptDamageReduction } from "./dialogs/apply-damage-dialog";

/** 振ったダメージを、押した瞬間のターゲットにそのまま適用する */
export async function applyDamage(this: AttackCardModel): Promise<void> {
  const amount = this.damageTotal;
  // canApplyDamage と同じ条件だが、ダメージ量の型を絞るためここでは直接見る
  if (amount === null) return;

  const targets = requireTargets();
  if (!targets) return;

  await applyDamageAndReport(targets, amount);
}

/**
 * 「軽減して適用」。軽減値と防具を尋ねてから適用する。
 *
 * 対象は押した瞬間に凍結する。ダイアログを開いている間にターゲットを付け替えても、
 * 防御判定を振った相手と適用先が食い違わないようにするため。
 */
export async function applyDamageWithReduction(this: AttackCardModel): Promise<void> {
  const amount = this.damageTotal;
  if (amount === null) return;

  const targets = requireTargets();
  if (!targets) return;

  const input = await promptDamageReduction({ amount, successCount: this.successCount, targets });
  if (!input) return;

  await applyDamageAndReport(targets, amount, { reduction: input.reduction, armor: input.armor });
}
