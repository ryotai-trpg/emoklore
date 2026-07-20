import type { SkillRollContext } from "../data/character";
import type { EmokloreRoll } from "../dice/emoklore-roll";
import type { EmokloreActor } from "../documents/actor";

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
 * チャットの見出しに出す判定名を組み立てる。「＊格闘」「★技能：専門」など。
 *
 * 基本技能は「＊」、エクストラ技能は「★」を頭に付けるのがシート表記の慣習。
 * 表示の話なのでルール層ではなく、チャットカードを作るこの層に置く。
 */
export function formatSkillName(
  { label, isExtra, specialization }: SkillRollContext,
  { base }: { base: boolean },
): string {
  const prefix = base ? "＊" : isExtra ? "★" : "";
  const suffix = specialization
    ? `${game.i18n.localize("EMOKLORE.Common.colon")}${specialization}`
    : "";

  return `${prefix}${label}${suffix}`;
}
