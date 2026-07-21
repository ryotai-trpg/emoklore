/**
 * 判定の入口。ダイアログで入力を集めてから `documents/` を呼ぶ。
 *
 * 「引数が無ければダイアログを開く」という判断はプレゼンテーションの決定なので、
 * Documentのメソッドではなくこちらが持つ。`documents/` 側は検証済みの値を必須引数で
 * 受け、ダイアログを一切知らない。
 *
 * 技能ロールに修正ダイアログ（DM修正・成功数修正）を足すときは `requestSkillRoll` を
 * ここに並べる。ただしあれは `RollSpec` を組み直す種類のダイアログで、共鳴判定の
 * ように `rules/` への入力を集めるものとは役割が違う。dnd5e が
 * `BasicRoll.build(config, dialog, message)` として `dice/` に持っているのは前者にあたる。
 */

import type { EmokloreActor } from "../documents/actor";
import { promptResonanceRoll } from "./dialogs/resonance-roll-dialog";

/** 共鳴判定。強度と共鳴感情の一致度を尋ねてから振る。キャンセルされたら何もしない */
export async function requestResonanceRoll(
  actor: EmokloreActor,
  options: Record<string, unknown> = {},
): Promise<ChatMessage | undefined> {
  const input = await promptResonanceRoll();
  if (!input) return;

  return actor.rollResonance(input.intensity, input.emotionMatch, options);
}
