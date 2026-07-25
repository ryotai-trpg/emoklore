import type { KaiAttackCardModel } from "../data/messages/kai-attack-card";
import { applyDamageAndReport, requireTargets } from "./damage";
import { promptDamageReduction } from "./dialogs/apply-damage-dialog";

/**
 * 怪異の攻撃カードの「ダメージ適用」ボタン。
 *
 * 武器カードの軽減つき適用と同じ流れを、怪異カードの状態（damageTotal / successCount）で回す。
 * `KaiAttackCardModel.ACTIONS` へは `module/emoklore.ts` の init が登録する。ハンドラを
 * `applications/` に置くことで、`data/` から `documents/` への逆依存を作らずに済む。
 */
export async function applyKaiDamage(this: KaiAttackCardModel): Promise<void> {
  const amount = this.damageTotal;
  if (amount === null) return;

  const targets = requireTargets();
  if (!targets) return;

  const input = await promptDamageReduction({ amount, successCount: this.successCount, targets });
  if (!input) return;

  await applyDamageAndReport(targets, amount, { reduction: input.reduction });
}
