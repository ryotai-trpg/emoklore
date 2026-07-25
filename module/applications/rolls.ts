/**
 * 判定の入口。ダイアログで入力を集めてから `documents/` を呼ぶ。
 *
 * 「引数が無ければダイアログを開く」という判断はプレゼンテーションの決定なので、
 * Documentのメソッドではなくこちらが持つ。`documents/` 側は検証済みの値を必須引数で
 * 受け、ダイアログを一切知らない。
 *
 * 判定オプション（ダイスボーナス・成功数修正・必要成功数）のダイアログもここに置く。
 * dnd5e は `BasicRoll.build(config, dialog, message)` として `dice/` に持っているが、
 * あちらはダイアログがRollクラスの静的メンバーで、パイプライン全体がRollの関心にある。
 * エモクロアの `EmokloreRoll.fromSpec` は決まりきった `RollSpec` を式に写すだけで、
 * ダイアログが組み直す相手はその手前の `SkillRollParams`（`rules/` への入力）になる。
 */

import type { SkillRef } from "../data/character";
import type { EmokloreActor } from "../documents/actor";
import { promptResonanceRoll } from "./dialogs/resonance-roll-dialog";
import { promptSkillRoll } from "./dialogs/skill-roll-dialog";

/**
 * 共鳴判定。強度と共鳴感情の一致度を尋ねてから振る。キャンセルされたら何もしない。
 *
 * こちらはPL側の手動フロー。DLからの要求カード（`applications/requests.ts`）と違い、
 * シートのボタンから自分で振るときに通る。対象アクターの〈∞共鳴〉値で振るので、
 * 怪異ではなく共鳴者を渡す。
 */
export async function requestResonanceRoll(
  actor: EmokloreActor,
  options: Record<string, unknown> = {},
  preset: { intensity?: number; emotion?: string } = {},
): Promise<ChatMessage | undefined> {
  // 一致度は選んだ感情とアクターの共鳴感情から自動で決まるので、突き合わせ先を渡す。
  // 共鳴判定は共鳴者だけが振れるが、判定側でも弾くのでここでは持っている分だけ渡す
  const owned = actor.isCharacter()
    ? actor.system.getOwnedEmotions()
    : { all: [], root: undefined };

  const input = await promptResonanceRoll({ ...preset, owned });
  if (!input) return;

  return actor.rollResonance(input.intensity, input.emotionMatch, options);
}

/**
 * 技能判定。判定オプションを尋ねてから振る。キャンセルされたら何もしない。
 *
 * シートからのクリックは即ロールが既定で、こちらは修飾キーで開く。ほとんどの判定に
 * 修正は付かないので、毎回ダイアログを挟むと手数が増えるだけになる。
 */
export async function requestSkillRoll(
  actor: EmokloreActor,
  ref: SkillRef,
  options: Record<string, unknown> = {},
): Promise<ChatMessage | undefined> {
  const input = await promptSkillRoll();
  if (!input) return;

  return actor.rollSkill(
    ref,
    { ...options, requiredSuccess: input.requiredSuccess },
    input.situational,
  );
}
