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
 *
 * `utils/` ではなく `documents/` に置いてあるのは、これが `actor.applyDamage()` を駆動する
 * オーケストレータでユーティリティではないため。`utils/` にあったときは `EmokloreActor` を
 * `import type` で借りていたので、importグラフの上では逆依存が見えなかった。
 */

import { SYSTEM_ID } from "../constants";
import type { DamageApplied } from "../utils/chat";
import type { EmokloreActor } from "./actor";

type ApplyDamageQuery = {
  type: "applyDamage";
  actorUuids: string[];
  amount: number;
  reduction: number;
  /**
   * 防具の上書き値。`undefined` は「各対象の装備中防具の合計を自動で使う」で、
   * `0` は「防具を使わない」の明示。`?? 0` に畳むと意味が変わるので畳まない
   */
  armor?: number | undefined;
};

/** 本体の型に出ないメンバーだけを補う */
type QueryableUser = { query: (name: string, data: unknown) => Promise<unknown> };

/**
 * クエリの受け口を登録する。`init` で1回だけ呼ぶ。
 *
 * 名前は他パッケージと衝突しないようシステムIDを使う（本体の予約と分けるための規約）。
 */
export function registerQueries(): void {
  const queries = CONFIG.queries as Record<string, (data: unknown) => Promise<unknown>>;

  queries[SYSTEM_ID] = async (data) => {
    const query = data as Partial<ApplyDamageQuery> | null;
    if (query?.type !== "applyDamage") return null;

    return applyDamageByUuid(
      query.actorUuids ?? [],
      query.amount ?? 0,
      query.reduction ?? 0,
      query.armor,
    );
  };
}

/**
 * ダメージを対象に適用する。
 *
 * 自分の権限で書けるならその場で、1体でも触れないものが混じっていればまとめてGMに
 * 預ける。一部だけ自分で処理すると適用の記録が2件に割れるため。
 *
 * 呼ぶ側は権限もGMの有無も気にしなくてよい。
 *
 * @returns 適用結果。委譲が必要なのにGMが誰も接続していなければ undefined
 */
export async function applyDamageToTargets(
  actors: EmokloreActor[],
  amount: number,
  { reduction = 0, armor }: { reduction?: number; armor?: number | undefined } = {},
): Promise<DamageApplied[] | undefined> {
  if (actors.every((actor) => actor.isOwner)) return applyDamage(actors, amount, reduction, armor);

  // ここに来た時点で自分はGMではない。GMは常に全アクターのOWNERなので、
  // 上の every を抜けている（common/abstract/document.mjs の testUserPermission）
  const gm = game.users?.activeGM as QueryableUser | null | undefined;
  if (!gm) return undefined;

  // 非リンクトークンの合成アクターは Scene.<id>.Token.<id>.Actor.<id> というUUIDを持ち、
  // これを送ることでそのトークンだけにダメージが入る。ワールドのアクターを送ると
  // 同じ元データから置いた雑魚が全員まとめて減る
  const query: ApplyDamageQuery = {
    type: "applyDamage",
    actorUuids: actors.map((actor) => actor.uuid).filter((uuid): uuid is string => !!uuid),
    amount,
    reduction,
    armor,
  };

  return (await gm.query(SYSTEM_ID, query)) as DamageApplied[];
}

/** UUIDで引いたアクターに適用する。委譲を受けた側の入口 */
async function applyDamageByUuid(
  actorUuids: string[],
  amount: number,
  reduction: number,
  armor: number | undefined,
): Promise<DamageApplied[]> {
  const resolved = await Promise.all(
    actorUuids.map((uuid) => foundry.utils.fromUuid(uuid) as Promise<EmokloreActor | null>),
  );

  return applyDamage(
    resolved.filter((actor): actor is EmokloreActor => !!actor),
    amount,
    reduction,
    armor,
  );
}

/** 実際にHPを減らして結果を集める。委譲する側とされる側で同じ処理を通す */
async function applyDamage(
  actors: EmokloreActor[],
  amount: number,
  reduction: number,
  armor: number | undefined,
): Promise<DamageApplied[]> {
  const applied: DamageApplied[] = [];

  for (const actor of actors) {
    const change = await actor.applyDamage(amount, { reduction, armor });
    // HPを持たないアクターやフックで中断された場合は結果が返らない
    if (change) applied.push({ actorUuid: actor.uuid ?? null, name: actor.name, ...change });
  }

  return applied;
}
