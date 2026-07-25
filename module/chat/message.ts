/**
 * ChatMessage を作る唯一の口。
 *
 * カードごとに違うのは種別・状態・中身のHTMLだけで、残り（ポップアウトの許可など）は
 * 共通なので、`ChatMessage.create` の呼び出しをここ1箇所に集める。公開範囲のような
 * 「全カードに一様に効く決まり」を足す場所も、必然的にここになる。
 */

import type { CardType } from "../data/messages/card-model";
import type { EmokloreRoll } from "../dice/emoklore-roll";
import type { EmokloreActor } from "../documents/actor";

/** 全カードに共通で載せるもの */
const COMMON_FLAGS = { core: { canPopout: true } };

/**
 * 型付きカード1枚ぶんの中身。
 *
 * `system` はサブタイプのスキーマと同じ形。型引数で受けるので、
 * 呼び出し側は `data/messages/` が持つ `*State` をそのまま渡せる。
 */
export type CardMessageData<S> = {
  type: CardType;
  system: S;
  content: string;
  speaker?: ReturnType<typeof ChatMessage.getSpeaker> | undefined;
  rolls?: foundry.dice.Roll[] | undefined;
  sound?: string | null | undefined;
};

/**
 * `ChatMessage.create` に渡す形まで組み立てる。作成はしない。
 *
 * フックに渡してから作るもの（武器カードの `emoklore.preUseWeapon`）は、
 * **フックが見る時点で完成していないといけない**ので、組み立てと作成を分けてある。
 */
export const buildCardMessageData = <S>(data: CardMessageData<S>) => ({
  ...data,
  flags: COMMON_FLAGS,
});

/** 組み立て済みのメッセージをチャットに置く。フックを挟んだ側の受け口 */
export async function postMessage(
  data: ReturnType<typeof buildCardMessageData>,
): Promise<ChatMessage | undefined> {
  // 本体の create は Document 止まりの型を返すので、ここで1回だけ絞る
  return (await ChatMessage.create(data)) as ChatMessage | undefined;
}

/** 型付きカードを1枚チャットに置く。フックを挟まないカードはこちらを使う */
export async function createCardMessage<S>(
  data: CardMessageData<S>,
): Promise<ChatMessage | undefined> {
  return postMessage(buildCardMessageData(data));
}

export type RollMessageData = {
  actor: EmokloreActor;
  /** チャットカードの見出し。「〈スピード〉判定」など */
  flavor: string;
  roll: EmokloreRoll;
};

/**
 * 判定結果をチャットに流す。
 *
 * 判定の種類によらず内容は同じなので、ここに集約している。サブタイプを持たない
 * （状態もボタンも無い）ので、カードの口とは分けてある。
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
    flags: COMMON_FLAGS,
  });

  return created as ChatMessage | undefined;
}
