import type { ResonanceMatch } from "./resonance-roll";

/** 共鳴者が持っている感情。マッチングに要る形だけを取り出したもの */
export type OwnedEmotions = {
  /**
   * 持っている感情すべて。表・裏・ルーツに追加取得を合わせたもの。
   *
   * 完全一致はこの4種すべてを見る。共振で得た感情も《怪異》が付与した感情も、
   * ルール上は「共鳴者の共鳴感情」として同じに扱われる
   */
  all: readonly string[];

  /**
   * ルーツの感情。未選択なら undefined。
   *
   * 属性一致を見るのは**ルーツだけ**。表や裏の属性が一致しても一致度は上がらない
   */
  root: string | undefined;
};

export type EmotionMatchParams = {
  owned: OwnedEmotions;
  /** DLが指定した感情。未指定なら空文字 */
  requested: string;
  /**
   * 感情キーから属性キーを引く。
   *
   * `rules/` は `config/` を型でしか読まないので、対応表は呼び出し側から渡してもらう。
   * 引けないキーは undefined で返す
   */
  attributeOf: (emotion: string) => string | undefined;
};

/**
 * 共鳴感情の一致度を決める。
 *
 * 完全一致は持っている感情のどれかが指定と同一のとき、ルーツ属性一致はルーツの
 * 感情属性が指定の属性と同じとき。**重複せず大きい方だけ**を採るので、完全一致を
 * 先に見て抜ける（ルーツそのものが指定と同一なら、属性も当然一致している）。
 */
export function resolveEmotionMatch({
  owned,
  requested,
  attributeOf,
}: EmotionMatchParams): ResonanceMatch {
  if (!requested) return "none";

  if (owned.all.includes(requested)) return "completely";

  if (!owned.root) return "none";

  const rootAttribute = attributeOf(owned.root);
  // 属性を引けない感情どうしを「どちらも undefined だから一致」にしない
  if (!rootAttribute) return "none";

  return rootAttribute === attributeOf(requested) ? "root" : "none";
}
