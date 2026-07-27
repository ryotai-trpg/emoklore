/**
 * ハウリング（極限共鳴）のボタンのハンドラ。
 *
 * 共鳴結果カードの「共鳴表を引く」と、引いた結果カードの「適用」。どちらもドキュメントの
 * 作成を駆動するので `data/` には置かず、`emoklore.ts` の init からそれぞれの `ACTIONS` に
 * 登録する（code-design.md「層とimportの方向」）。
 */

import { buildHowlingDrawState, createHowlingDrawMessage } from "../chat/howling-draw";
import type { HowlingDrawModel } from "../data/messages/howling-draw";
import type { ResonanceOutcomeModel } from "../data/messages/resonance-outcome";
import type { EmokloreActor } from "../documents/actor";
import { resolveResonanceTable } from "../utils/howling";

/**
 * 共鳴結果カードの「共鳴表を引く」。怪異に紐づいた表を1回引き、結果をカードに出す。
 *
 * 誰が押しても引ける。カードの内容は全員に同じものが配られるのでDL専用のボタンは作れず、
 * 引くこと自体は何も壊さない（`roll()` はDBに書かない）。適用の側で持ち主を見る。
 */
export async function drawHowling(this: ResonanceOutcomeModel): Promise<void> {
  const table = await resolveResonanceTable(this.kaiUuid);
  if (!table) {
    ui.notifications?.warn("EMOKLORE.Howling.NoTable", { localize: true });
    return;
  }

  const { roll, results } = await table.roll();
  const [result] = results;
  if (!result) {
    // `replacement: false` の表を引き切ると roll() が空で返る。戻す（resetResults）のは
    // 表の持ち主の操作なので、ここでは何が起きたかを言って止まる
    ui.notifications?.warn("EMOKLORE.Howling.Exhausted", { localize: true });
    return;
  }

  const actor = this.actorUuid
    ? ((await foundry.utils.fromUuid(this.actorUuid)) as EmokloreActor | null)
    : null;

  const state = await buildHowlingDrawState(result, {
    actorUuid: this.actorUuid,
    name: this.name,
    kaiUuid: this.kaiUuid,
    tableUuid: table.uuid,
  });

  await createHowlingDrawMessage(state, roll, actor);
}

/**
 * 引いた結果カードの「適用」。反応アイテムを共鳴者に作る。
 *
 * アイテムが乗ると、そこに付いている効果（transfer）がそのまま共鳴者に乗る。回復は
 * このアイテムを消すことなので、効果を個別に付け外しする経路は持たない。
 */
export async function applyHowling(this: HowlingDrawModel): Promise<void> {
  // ボタンは itemUuid と actorUuid が揃っているときしか描かれない
  if (!this.itemUuid || !this.actorUuid) return;

  const actor = (await foundry.utils.fromUuid(this.actorUuid)) as EmokloreActor | null;
  if (!actor) {
    ui.notifications?.warn("EMOKLORE.Howling.NoActor", { localize: true });
    return;
  }

  // GMは常に全アクターのOWNERなので、ここで止まるのは他人のカードを押したときになる
  if (!actor.isOwner) {
    ui.notifications?.warn("EMOKLORE.Howling.NotOwner", { localize: true });
    return;
  }

  const item = (await foundry.utils.fromUuid(this.itemUuid)) as {
    toObject: () => Record<string, unknown>;
  } | null;
  if (!item) {
    ui.notifications?.warn("EMOKLORE.Howling.NoReaction", { localize: true });
    return;
  }

  await actor.createEmbeddedDocuments("Item", [item.toObject()]);

  ui.notifications?.info("EMOKLORE.Howling.Applied", {
    format: { reaction: this.reactionName, name: actor.name },
  });
}
