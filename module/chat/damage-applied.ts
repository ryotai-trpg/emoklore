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
import { getSetting } from "../settings";
import { createCardMessage, type MessageMode } from "./message";

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
const statusLabel = (statusId: string): string => _loc(CONFIG.statusEffects[statusId]?.name ?? "");

/** 状態の付与ボタンの文言。HPの案内とMPの案内で同じ形 */
const applyStatusLabel = (statusId: string): string =>
  _loc("EMOKLORE.ChatMessage.damageApplied.ApplyStatus", {
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
  const line = _loc(lineKey, { name, before, after, reduction, armor });

  // 案内は設定で切れる。切ると結果の行だけが残る
  if (!getSetting("autoHpBoundaryNotice")) return { line };

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
      text: _loc(textKey),
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
 * 結果カードを誰に見せるか。
 *
 * 既定（全員）では何も返さない。本体は `options.messageMode` があるときだけ `applyMode` を
 * 通すので、渡さないことがそのまま「全員に出す」になる。
 */
const resolveVisibility = (): MessageMode | undefined => {
  switch (getSetting("damageResultVisibility")) {
    case "gm":
      return "gm";
    // チャット欄のモード選択に従う。本体の applyMode が既定で読むのと同じ設定
    case "mode":
      return game.settings.get("core", "messageMode") as MessageMode;
    default:
      return undefined;
  }
};

/**
 * ダメージ適用の結果をチャットに流す。「アクター名 HP: 15 → 12」を対象の数だけ並べる。
 *
 * 適用した本人にしか見えない通知ではなく、卓の全員が経過を追えるようにチャットへ出す。
 * 敵のHPを伏せたい卓は、公開範囲を設定で絞れる。
 */
export async function createDamageAppliedMessage(
  applied: AppliedTarget[],
  { reduction = 0 }: { reduction?: number } = {},
): Promise<ChatMessage | undefined> {
  // サブタイプにするのは、境界の案内のボタンにリスナの配線先（system.addListeners）が
  // 要るため。境界の判定に使った前後の値も system に焼き込む
  const system: DamageAppliedState = { resource: "hp", reduction, targets: applied };

  return createCardMessage(
    {
      type: "damageApplied",
      system,
      content: await renderCard(applied.map((target) => buildHpEntry(target, reduction))),
    },
    { messageMode: resolveVisibility() },
  );
}

/**
 * MPが0以下にまたいだ案内をチャットに流す。
 *
 * MPには applyDamage のような一元の減少口が無く、シートの直接編集が減少手段なので、
 * `EmokloreActor._onUpdate` からここに来る。判定の強制や【失神】の自動付与はしない。
 *
 * **公開範囲の設定は効かせない。** あれは「敵のHPを伏せる」ための設定で、こちらは
 * 自分のシートを編集した結果の案内なので、伏せる理由が無い。
 */
export async function createMpNoticeMessage(
  actor: EmokloreActor,
  { before, after }: { before: number; after: number },
): Promise<ChatMessage | undefined> {
  const actorUuid = actor.uuid ?? null;
  const entry: EntryContext = {
    line: _loc("EMOKLORE.ChatMessage.damageApplied.MpLine", {
      name: actor.name,
      before,
      after,
    }),
    notice: {
      text: _loc("EMOKLORE.ChatMessage.damageApplied.MpZero"),
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
