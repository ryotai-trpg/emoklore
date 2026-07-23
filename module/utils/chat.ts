import { systemPath } from "../constants";
import type { SkillRollContext } from "../data/character";
import type { EmokloreRoll } from "../dice/emoklore-roll";
import type { EmokloreActor } from "../documents/actor";
import { skillMarker } from "./skill";

const DAMAGE_APPLIED_TEMPLATE = systemPath("templates/chat/damage-applied.hbs");

/** ダメージを適用した1体ぶんの結果 */
export type DamageApplied = {
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
  // 軽減したときだけ内訳を添える。0のときまで「（軽減 0）」と出すのは雑音
  const key =
    reduction > 0
      ? "EMOKLORE.ChatMessage.weapon.AppliedWithReduction"
      : "EMOKLORE.ChatMessage.weapon.Applied";
  const lines = applied.map(({ name, before, after }) =>
    game.i18n.localize(key, { name, before, after, reduction }),
  );

  const created = await ChatMessage.create({
    content: await foundry.applications.handlebars.renderTemplate(DAMAGE_APPLIED_TEMPLATE, {
      lines,
    }),
    flags: { core: { canPopout: true } },
  });

  return created as ChatMessage | undefined;
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
