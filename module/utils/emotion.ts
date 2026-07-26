/**
 * 共鳴感情の小物。`config/` の対応表を引くところまでを持ち、判断そのものは `rules/` にある。
 */

import { isResonantEmotionKey } from "../config/resonant-emotions";
import { type OwnedEmotions, resolveEmotionMatch } from "../rules/emotion-match";
import type { ResonanceMatch } from "../rules/resonance-roll";
import { joinCompact } from "./format";

/**
 * 感情キーから属性キーを引く。知らないキーは undefined。
 *
 * 表・裏・ルーツは素の StringField で `choices` が無いので、保存データは型を裏切りうる。
 * CONFIG を引く前に型述語を通す。
 */
const attributeOf = (emotion: string): string | undefined =>
  isResonantEmotionKey(emotion) ? CONFIG.EMOKLORE.resonantEmotions[emotion].attribute : undefined;

/** 共鳴者の感情と、DLが指定した感情（複数可）から一致度を決める */
export const matchEmotion = (owned: OwnedEmotions, requested: readonly string[]): ResonanceMatch =>
  resolveEmotionMatch({ owned, requested, attributeOf });

/** 感情の表示名。「怒り（情念）」。未選択・未知のキーは空文字 */
export const formatEmotion = (emotion: string): string => {
  if (!isResonantEmotionKey(emotion)) return "";

  const { label, attribute } = CONFIG.EMOKLORE.resonantEmotions[emotion];
  return _loc("EMOKLORE.Format.resonantEmotion", {
    emotion: label,
    attribute: CONFIG.EMOKLORE.emotionAttributes[attribute].label,
  });
};

/** 感情の一覧の表示。「怒り（情念）／恨み（情念）」。未知のキーは落とす */
export const formatEmotions = (emotions: Iterable<string>): string =>
  joinCompact([...emotions].map(formatEmotion).filter((label) => label !== ""));
