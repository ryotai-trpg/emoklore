/**
 * 盤面と担当から、操作の主体と対象を決める。エモクロア固有のルールは持たない。
 *
 * **ターゲット（右クリックの印）は当てる先、選択（クリックで掴む）は振る側。**
 * 同じ盤面を見ていても向きが逆なので、2つの入口を分けてある。理由はそれぞれの
 * 関数に書いてある。
 */

import type { EmokloreActor } from "../documents/actor";

/** 盤面のトークンのうち、実際に使うメンバーだけを交差型で補う */
type TargetToken = { actor?: EmokloreActor | null };

/**
 * 本体の型に出ないメンバーだけを補う。
 *
 * トークンレイヤーは canvas の準備が済むまで存在しないので任意で受ける
 * （シーンを開いていない卓では最後まで生えない）。
 */
type TokenBoard = { tokens?: { controlled: TargetToken[] } };

/** 同上。判定を振る側を決めるのに使うメンバーだけ */
type ActingUser = { character?: EmokloreActor | null; isGM: boolean };

/**
 * ダメージなどを当てる対象のアクターを集める。
 *
 * ターゲット（右クリックで付ける印）だけを見る。選択（トークンをクリックして掴む）は
 * 見ない。攻撃する側のトークンを選んだまま撃つことが多く、選択を対象にすると
 * 自分を殴ってしまうため。
 *
 * カードを出した時点のターゲットを焼き込む手もあるが、それだと後から狙いを
 * 付け替えられない。押した瞬間の盤面を正とする。
 *
 * **ワールドのアクターではなく `token.actor` を取ること**。本体はリンクトークンなら
 * ワールドのアクターを、非リンクトークンならそのトークン専用の合成アクター
 * （ActorDelta由来）を返す（`client/documents/token.mjs` の `TokenDocument#actor`）。
 * 雑魚を同じ元データから何体も置く使い方では、これを取り違えると1体を殴っただけで
 * 全員のHPが減る。
 *
 * 重複はアクターの実体で除く。リンクトークンを2つ並べた場合は同じアクターなので
 * 1回だけ数え（HPを共有しているため正しい）、非リンクトークンは1体ずつ別の合成
 * アクターなのでそれぞれ数える。
 */
export function resolveTargetActors(): EmokloreActor[] {
  const targeted = Array.from(game.user?.targets ?? []) as TargetToken[];

  const actors = new Set<EmokloreActor>();
  for (const token of targeted) {
    if (token.actor) actors.add(token.actor);
  }

  return Array.from(actors);
}

/**
 * 判定を振る側のアクターを決める。要求カードのボタンを押した人が誰で振るか。
 *
 * 順序は本体の `ChatMessage.getSpeaker()` に合わせる（`client/documents/chat-message.mjs`
 * の CASE 4・CASE 5）。カード経由の判定だけ発言者の決まり方が違う、という状態を作らない
 * ため。本体が見ない3段目だけを自前で足してある。
 *
 * 1. 選択中のトークン。**ここは `resolveTargetActors` と逆で、選択を見るのが正しい。**
 *    あちらが選択を見ないのは「攻撃する側を選んだまま撃つと自分を殴る」ためで、
 *    振る側を決めるときは、いま掴んでいる駒こそが自分になる
 * 2. 担当キャラクター（`game.user.character`）
 * 3. 所有している共鳴者・人間NPCがちょうど1体ならそれ。シーンを開かない卓では
 *    1が空になるので、ここを省くと誰も振れないカードになる
 *
 * **GMは2段目で止める。** GMは世界の全アクターの所有者なので、3段目まで落とすと
 * 「所有アクターが1体」に当たることがまず無く、当たっても意図しないアクターになる。
 * GMが代打で振るときはトークンを選んで押す（1段目）。
 *
 * @returns 決まらなければ undefined。呼び出し側が何を選ばせたいかを通知する
 */
export function resolveActingActor(): EmokloreActor | undefined {
  const board = canvas as TokenBoard | null | undefined;
  const fromToken = board?.tokens?.controlled.find((token) => token.actor)?.actor;
  if (fromToken) return fromToken;

  const user = game.user as ActingUser | null | undefined;
  if (user?.character) return user.character;

  if (user?.isGM) return undefined;

  // 怪異は技能判定を持たないので、候補から外して数える
  const owned = (game.actors?.filter(
    (actor) => actor.isOwner && (actor as EmokloreActor).isCharacterLike(),
  ) ?? []) as EmokloreActor[];

  return owned.length === 1 ? owned[0] : undefined;
}

/**
 * 判定を振る側のアクターを集める。1回の操作で複数体ぶん振りたいとき用。
 *
 * 選択中のトークンが複数あればその全部、無ければ `resolveActingActor` の1体。
 * DLが共鳴者を並べて選び、まとめて共鳴判定を振らせる導線がこれにあたる。
 * PLが自分のトークンを1つ選んでいるだけなら結果は1体で、単数の入口と変わらない。
 */
export function resolveActingActors(): EmokloreActor[] {
  const board = canvas as TokenBoard | null | undefined;
  const controlled = board?.tokens?.controlled ?? [];

  // 同じアクターのトークンを2つ選んでいても1回だけ振る
  const actors = new Set<EmokloreActor>();
  for (const token of controlled) {
    if (token.actor) actors.add(token.actor);
  }
  if (actors.size > 0) return Array.from(actors);

  const single = resolveActingActor();
  return single ? [single] : [];
}
