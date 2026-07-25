import type { KaiAttackCardModel } from "../data/messages/kai-attack-card";
import { applyDamageToTargets } from "../documents/queries";
import { createDamageAppliedMessage } from "../utils/chat";
import { resolveTargetActors } from "../utils/targets";
import { promptDamageReduction } from "./dialogs/apply-damage-dialog";

/**
 * 怪異の攻撃カードの「ダメージ適用」ボタン。
 *
 * 武器カードの軽減つき適用と同じ流れを、怪異カードの状態（damageTotal / successCount）で回す。
 * `KaiAttackCardModel.ACTIONS` へは `module/emoklore.ts` の init が登録する。ハンドラを
 * `applications/` に置くことで、`data/` から `documents/` への逆依存を作らずに済む
 * （architecture.md 課題5 を怪異カードで繰り返さない）。
 */
export async function applyKaiDamage(this: KaiAttackCardModel): Promise<void> {
  const amount = this.damageTotal;
  if (amount === null) return;

  // 対象は押した瞬間に凍結する。ダイアログを開いている間の付け替えで、防御判定を振った
  // 相手と適用先が食い違わないようにするため
  const targets = resolveTargetActors();
  if (targets.length === 0) {
    ui.notifications?.warn("EMOKLORE.ChatMessage.weapon.NoTarget", { localize: true });
    return;
  }

  const input = await promptDamageReduction({ amount, successCount: this.successCount, targets });
  if (!input) return;

  // 権限の有無とGMへの委譲は documents/queries.ts が引き受ける
  const applied = await applyDamageToTargets(targets, amount, { reduction: input.reduction });
  if (!applied) {
    ui.notifications?.warn("EMOKLORE.ChatMessage.weapon.NoGM", { localize: true });
    return;
  }

  if (applied.length > 0) await createDamageAppliedMessage(applied, { reduction: input.reduction });
}
