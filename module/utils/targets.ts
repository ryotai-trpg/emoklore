/**
 * 盤面から操作の対象を集める。エモクロア固有のルールは持たない。
 */

import type { EmokloreActor } from "../documents/actor";

/** 盤面のトークンのうち、実際に使うメンバーだけを交差型で補う */
type TargetToken = { actor?: EmokloreActor | null };

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
