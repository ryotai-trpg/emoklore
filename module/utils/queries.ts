/**
 * GMへの処理の委譲。
 *
 * Foundryは `Document#update` をサーバ側で権限検査するので、OWNER権限を持たない
 * アクター（多くの場合、敵）はプレイヤーのクライアントからは書き換えられない。
 * 非リンクトークンの合成アクターも元のアクターの ownership を引き継ぐため事情は同じ。
 * 権限を持つGMのクライアントに肩代わりしてもらう。
 *
 * 生の `game.socket` ではなく本体のクエリ機構（`CONFIG.queries` と `User#query`）を使う。
 * 応答が戻るので結果の組み立てを1箇所にまとめられ、タイムアウトとエラー伝播も本体が持つ。
 * `system.json` の `"socket": true` も要らない（クエリは core の `userQuery` イベントを通る）。
 * draw-steel の `DrawSteelSocketHandler` と同じ形。
 */

import { systemID } from "../constants";
import type { EmokloreActor } from "../documents/actor";
import type { DamageApplied } from "./chat";

type ApplyDamageQuery = {
  type: "applyDamage";
  actorUuids: string[];
  amount: number;
};

/** 本体の型に出ないメンバーだけを補う */
type QueryableUser = { isSelf: boolean; query: (name: string, data: unknown) => Promise<unknown> };

/**
 * クエリの受け口を登録する。`init` で1回だけ呼ぶ。
 *
 * 名前は他パッケージと衝突しないようシステムIDを使う（本体の予約と分けるための規約）。
 */
export function registerQueries(): void {
  const queries = CONFIG.queries as Record<string, (data: unknown) => Promise<unknown>>;

  queries[systemID] = async (data) => {
    const query = data as Partial<ApplyDamageQuery> | null;
    if (query?.type !== "applyDamage") return null;

    return applyDamageByUuid(query.actorUuids ?? [], query.amount ?? 0);
  };
}

/**
 * ダメージ適用をGMに肩代わりしてもらう。
 *
 * 自分がその指名GMなら委譲せずその場で処理する。
 *
 * @returns 適用結果。GMが誰も接続していなければ undefined
 */
export async function requestApplyDamage(
  actors: EmokloreActor[],
  amount: number,
): Promise<DamageApplied[] | undefined> {
  const gm = game.users?.activeGM as (QueryableUser & { id: string }) | null | undefined;
  if (!gm) return undefined;

  // 非リンクトークンの合成アクターは Scene.<id>.Token.<id>.Actor.<id> というUUIDを持ち、
  // これを送ることでそのトークンだけにダメージが入る。ワールドのアクターを送ると
  // 同じ元データから置いた雑魚が全員まとめて減る
  const actorUuids = actors.map((actor) => actor.uuid).filter((uuid): uuid is string => !!uuid);

  if (gm.isSelf) return applyDamageByUuid(actorUuids, amount);

  const query: ApplyDamageQuery = { type: "applyDamage", actorUuids, amount };

  return (await gm.query(systemID, query)) as DamageApplied[];
}

/** UUIDで引いたアクターにダメージを適用する。委譲する側とされる側で同じ処理を通す */
async function applyDamageByUuid(actorUuids: string[], amount: number): Promise<DamageApplied[]> {
  const applied: DamageApplied[] = [];

  for (const uuid of actorUuids) {
    const actor = (await foundry.utils.fromUuid(uuid)) as EmokloreActor | null;
    if (!actor) continue;

    const change = await actor.applyDamage(amount);
    // HPを持たないアクターやフックで中断された場合は結果が返らない
    if (change) applied.push({ name: actor.name, ...change });
  }

  return applied;
}
