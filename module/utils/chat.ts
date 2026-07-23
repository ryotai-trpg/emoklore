import { systemPath } from "../constants";
import type { SkillRollContext } from "../data/character";
import type { EmokloreRoll } from "../dice/emoklore-roll";
import type { EmokloreActor } from "../documents/actor";
import { resolveHpBoundary } from "../rules/resource-boundary";
import { skillMarker } from "./skill";

const DAMAGE_APPLIED_TEMPLATE = systemPath("templates/chat/damage-applied.hbs");

/** ダメージを適用した1体ぶんの結果 */
export type DamageApplied = {
  /** 境界の案内から状態を付与するときの参照。引けなければ null */
  actorUuid: string | null;
  name: string;
  before: number;
  after: number;
};

export type RollMessageData = {
  actor: EmokloreActor;
  /** チャットカードの見出し。「〈スピード〉判定」など */
  flavor: string;
  roll: EmokloreRoll;
};

/**
 * 判定結果をチャットに流す。
 *
 * 判定の種類によらず内容は同じなので、ここに集約している。
 */
export async function createRollMessage({
  actor,
  flavor,
  roll,
}: RollMessageData): Promise<ChatMessage | undefined> {
  const created = await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor,
    rolls: [roll],
    sound: CONFIG.sounds.dice,
    flags: { core: { canPopout: true } },
  });

  return created as ChatMessage | undefined;
}

/**
 * ダメージ適用の結果をチャットに流す。「アクター名 HP: 15 → 12」を対象の数だけ並べる。
 *
 * 適用した本人にしか見えない通知ではなく、卓の全員が経過を追えるようにチャットへ出す。
 * 敵のHPまで全員に見えるのは意図した割り切りで、まずは動きが分かることを優先している。
 * 伏せ方の検討はロードマップにある（秘匿判定に対応していない Issue #16 と同じ話になる）。
 */
export async function createDamageAppliedMessage(
  applied: DamageApplied[],
  { reduction = 0 }: { reduction?: number } = {},
): Promise<ChatMessage | undefined> {
  const created = await ChatMessage.create({
    // サブタイプにするのは、境界の案内のボタンにリスナの配線先（system.addListeners）が
    // 要るため。境界の判定に使った前後の値も system に焼き込む
    type: "damageApplied",
    system: { resource: "hp", reduction, targets: applied },
    content: await foundry.applications.handlebars.renderTemplate(DAMAGE_APPLIED_TEMPLATE, {
      entries: applied.map((target) => buildHpEntry(target, reduction)),
    }),
    flags: { core: { canPopout: true } },
  });

  return created as ChatMessage | undefined;
}

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

/**
 * 対象1体ぶんの行と、境界をまたいでいれば案内を組み立てる。
 *
 * ルールブックの多段の境界処理（気絶判定・心肺停止）は案内と付与ボタンまで。
 * 判定の強制や状態の自動付与はしない。
 */
function buildHpEntry(
  { actorUuid, name, before, after }: DamageApplied,
  reduction: number,
): EntryContext {
  // 軽減したときだけ内訳を添える。0のときまで「（軽減 0）」と出すのは雑音
  const lineKey =
    reduction > 0
      ? "EMOKLORE.ChatMessage.weapon.AppliedWithReduction"
      : "EMOKLORE.ChatMessage.weapon.Applied";
  const line = game.i18n.localize(lineKey, { name, before, after, reduction });

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
      buttonLabel: game.i18n.localize("EMOKLORE.ChatMessage.damageApplied.ApplyStatus", {
        status: statusLabel(statusId),
      }),
      actorUuid,
    },
  };
}

/**
 * チャットの見出しに出す判定名を組み立てる。「＊格闘」「★技能：専門」など。
 *
 * 基本技能は「＊」、エクストラ技能は「★」を頭に付けるのがシート表記の慣習。
 * 表示の話なのでルール層ではなく、チャットカードを作るこの層に置く。
 */
export function formatSkillName({
  label,
  isBase,
  isExtra,
  specialization,
}: SkillRollContext): string {
  const prefix = skillMarker(isBase, isExtra);
  const suffix = specialization
    ? `${game.i18n.localize("EMOKLORE.Common.colon")}${specialization}`
    : "";

  return `${prefix}${label}${suffix}`;
}
