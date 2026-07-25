/**
 * ダメージ適用の後段。武器カードと怪異の攻撃カードで共通。
 *
 * 対象の集め方はボタンごとに違う（即適用はターゲット、軽減つきはダイアログを挟む）ので、
 * その先だけをここに置く。権限の有無とGMへの委譲は `documents/queries.ts` が引き受ける。
 */

import { createDamageAppliedMessage } from "../chat/damage-applied";
import type { EmokloreActor } from "../documents/actor";
import { applyDamageToTargets } from "../documents/queries";
import { resolveTargetActors } from "../utils/targets";

/**
 * ダメージを対象へ適用し、結果をチャットに流す。
 *
 * 呼ぶ側は権限もGMの有無も気にしなくてよい。触れない対象が混じっていればまとめて
 * GMに預け、GMが誰も接続していなければ何もせず通知だけ返す。
 *
 * `armor` の `undefined` は「各対象の装備中防具の合計を自動で使う」、`0` は「防具を
 * 使わない」の明示。意味が違うので `?? 0` に畳まない。
 */
export async function applyDamageAndReport(
  targets: EmokloreActor[],
  amount: number,
  { reduction = 0, armor }: { reduction?: number; armor?: number | undefined } = {},
): Promise<void> {
  const applied = await applyDamageToTargets(targets, amount, { reduction, armor });
  if (!applied) {
    ui.notifications?.warn("EMOKLORE.ChatMessage.weapon.NoGM", { localize: true });
    return;
  }

  if (applied.length > 0) await createDamageAppliedMessage(applied, { reduction });
}

/**
 * 押した瞬間のターゲットを集める。1体も無ければ通知して null。
 *
 * 対象は押した瞬間に凍結する。ダイアログを開いている間にターゲットを付け替えても、
 * 防御判定を振った相手と適用先が食い違わないようにするため。
 */
export function requireTargets(): EmokloreActor[] | null {
  const targets = resolveTargetActors();
  if (targets.length > 0) return targets;

  ui.notifications?.warn("EMOKLORE.ChatMessage.weapon.NoTarget", { localize: true });
  return null;
}
