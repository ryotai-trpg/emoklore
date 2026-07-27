/**
 * ChatMessage を作る・育てる唯一の口。
 *
 * カードごとに違うのは種別・状態・中身のHTMLだけで、残り（ポップアウトの許可など）は
 * 共通なので、`ChatMessage.create` の呼び出しをここ1箇所に集める。公開範囲のような
 * 「全カードに一様に効く決まり」を足す場所も、必然的にここになる。
 *
 * 育つカード（武器・怪異の攻撃）の書き戻しも同じ理由でここに置く。押すたびに
 * `content` を組み直すのはカードごとの仕事だが、更新の当て方とダイス音は共通になる。
 */

import type { CardMessage } from "../data/messages/attack-card";
import type { CardType } from "../data/messages/card-model";
import type { EmokloreRoll } from "../dice/emoklore-roll";
import type { EmokloreActor } from "../documents/actor";

/** 全カードに共通で載せるもの */
const COMMON_FLAGS = { core: { canPopout: true } };

/**
 * メッセージの公開範囲。本体の `CONFIG.ChatMessage.modes` のキー。
 *
 * v14 は `ChatMessage#_preCreate` が `options.messageMode` を見て `applyMode` を通す。
 * **渡さなければ `applyMode` 自体が走らない**ので、「そのまま全員に出す」が既定になる。
 * `ChatMessage.applyRollMode` は v14 で非推奨なので使わない。
 */
export type MessageMode = "public" | "self" | "gm" | "blind" | "ic";

export type PostOptions = {
  /** 省略すると全員に出る。`"mode"` 相当（チャット欄の選択に従う）は呼び出し側が解決する */
  messageMode?: MessageMode | undefined;
};

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

/**
 * 本体の `create` の第2引数。
 *
 * `messageMode` は `ChatMessage#_preCreate` が読むが、本体の
 * `DatabaseCreateOperation` には宣言が無いので足す（実際に使う1つだけ）。
 */
type CreateOptions = Parameters<typeof ChatMessage.create>[1] & { messageMode?: MessageMode };

/** 組み立て済みのメッセージをチャットに置く。フックを挟んだ側の受け口 */
export async function postMessage(
  data: ReturnType<typeof buildCardMessageData>,
  { messageMode }: PostOptions = {},
): Promise<ChatMessage | undefined> {
  const options: CreateOptions = messageMode ? { messageMode } : {};

  // 本体の create は Document 止まりの型を返すので、ここで1回だけ絞る
  return (await ChatMessage.create(data, options)) as ChatMessage | undefined;
}

/** 型付きカードを1枚チャットに置く。フックを挟まないカードはこちらを使う */
export async function createCardMessage<S>(
  data: CardMessageData<S>,
  options: PostOptions = {},
): Promise<ChatMessage | undefined> {
  return postMessage(buildCardMessageData(data), options);
}

/**
 * 振った結果をカードに書き戻す。
 *
 * `content` を毎回組み直すのは、ボタンの出し分けと結果の表示が状態と一緒に変わるため。
 * 組み立てはカードごとに違うので、呼ぶ側が済ませたものを受ける。
 *
 * 作成時と違って更新では `sound` が鳴らないので、ダイス音はここで明示的に鳴らす。
 */
export async function updateCardMessage<S>(
  message: CardMessage,
  { content, rolls, system }: { content: string; rolls: foundry.dice.Roll[]; system: S },
): Promise<void> {
  await message.update({ content, rolls, system });

  // モジュールが CONFIG.sounds を空にしている場合があるので、あるときだけ鳴らす
  const sound = CONFIG.sounds.dice;
  if (sound) foundry.audio.AudioHelper.play({ src: sound }, true);
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
