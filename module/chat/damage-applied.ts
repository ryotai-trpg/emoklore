/**
 * ダメージ適用（とMP減少）の結果カードの組み立て。
 *
 * 「アクター名 HP: 15 → 12」の行と、境界をまたいだときの案内を持つ。案内は状態の付与
 * ボタンまでで、判定の強制や状態の自動付与はしない（`docs/roadmap.md`「実装しないこと:
 * 高度な自動化」）。
 */

import { systemPath } from "../constants";
import type { AppliedTarget, DamageAppliedState } from "../data/messages/damage-applied";
import type { EmokloreActor } from "../documents/actor";
import { resolveHpBoundary } from "../rules/resource-boundary";
import { createCardMessage } from "./message";

const TEMPLATE = systemPath("templates/chat/damage-applied.hbs");

/** 案内1件ぶんの描画データ。actorUuid が引けないときはボタンなしで文だけ出す */
type NoticeContext = {
  text: string;
  statusId: string;
  buttonLabel: string;
  actorUuid: string | null;
};

type EntryContext = { line: string; notice?: NoticeContext };

/** 状態の表示名。CONFIG.statusEffects の name はi18nキー */
const statusLabel = (statusId: string): string =>
  game.i18n.localize(CONFIG.statusEffects[statusId]?.name ?? "");

/** 状態の付与ボタンの文言。HPの案内とMPの案内で同じ形 */
const applyStatusLabel = (statusId: string): string =>
  game.i18n.localize("EMOKLORE.ChatMessage.damageApplied.ApplyStatus", {
    status: statusLabel(statusId),
  });

/**
 * 対象1体ぶんの行と、境界をまたいでいれば案内を組み立てる。
 *
 * ルールブックの多段の境界処理（気絶判定・心肺停止）は案内と付与ボタンまで。
 * 判定の強制や状態の自動付与はしない。
 */
function buildHpEntry(
  { actorUuid, name, before, after, armor }: AppliedTarget,
  reduction: number,
): EntryContext {
  // 効いたぶんだけ内訳を添える。0のときまで「（軽減 0）」と出すのは雑音。
  // 軽減は1回の適用で共通、防具は対象ごとに違う
  const lineKey =
    reduction > 0 && armor > 0
      ? "EMOKLORE.ChatMessage.weapon.AppliedWithReductionAndArmor"
      : reduction > 0
        ? "EMOKLORE.ChatMessage.weapon.AppliedWithReduction"
        : armor > 0
          ? "EMOKLORE.ChatMessage.weapon.AppliedWithArmor"
          : "EMOKLORE.ChatMessage.weapon.Applied";
  const line = game.i18n.localize(lineKey, { name, before, after, reduction, armor });

  const boundary = resolveHpBoundary({ before, after });
  if (!boundary) return { line };

  const statusId = boundary === "cardiacArrest" ? "cardiacArrest" : "unconscious";
  const textKey =
    boundary === "cardiacArrest"
      ? "EMOKLORE.ChatMessage.damageApplied.HpZero"
      : "EMOKLORE.ChatMessage.damageApplied.HalfLoss";

  return {
    line,
    notice: {
      text: game.i18n.localize(textKey),
      statusId,
      buttonLabel: applyStatusLabel(statusId),
      actorUuid,
    },
  };
}

/** カードのHTMLを組み立てる。行の並びはそのまま対象の並び */
const renderCard = (entries: EntryContext[]): Promise<string> =>
  foundry.applications.handlebars.renderTemplate(TEMPLATE, { entries });

/**
 * ダメージ適用の結果をチャットに流す。「アクター名 HP: 15 → 12」を対象の数だけ並べる。
 *
 * 適用した本人にしか見えない通知ではなく、卓の全員が経過を追えるようにチャットへ出す。
 */
export async function createDamageAppliedMessage(
  applied: AppliedTarget[],
  { reduction = 0 }: { reduction?: number } = {},
): Promise<ChatMessage | undefined> {
  // サブタイプにするのは、境界の案内のボタンにリスナの配線先（system.addListeners）が
  // 要るため。境界の判定に使った前後の値も system に焼き込む
  const system: DamageAppliedState = { resource: "hp", reduction, targets: applied };

  return createCardMessage({
    type: "damageApplied",
    system,
    content: await renderCard(applied.map((target) => buildHpEntry(target, reduction))),
  });
}

/**
 * MPが0以下にまたいだ案内をチャットに流す。
 *
 * MPには applyDamage のような一元の減少口が無く、シートの直接編集が減少手段なので、
 * `EmokloreActor._onUpdate` からここに来る。判定の強制や【失神】の自動付与はしない。
 */
export async function createMpNoticeMessage(
  actor: EmokloreActor,
  { before, after }: { before: number; after: number },
): Promise<ChatMessage | undefined> {
  const actorUuid = actor.uuid ?? null;
  const entry: EntryContext = {
    line: game.i18n.localize("EMOKLORE.ChatMessage.damageApplied.MpLine", {
      name: actor.name,
      before,
      after,
    }),
    notice: {
      text: game.i18n.localize("EMOKLORE.ChatMessage.damageApplied.MpZero"),
      statusId: "faint",
      buttonLabel: applyStatusLabel("faint"),
      actorUuid,
    },
  };

  const system: DamageAppliedState = {
    resource: "mp",
    reduction: 0,
    targets: [{ actorUuid, name: actor.name, before, after, armor: 0 }],
  };

  return createCardMessage({
    type: "damageApplied",
    system,
    content: await renderCard([entry]),
  });
}
