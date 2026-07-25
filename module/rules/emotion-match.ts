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
  /**
   * DLが指定した感情。空なら指定なし。
   *
   * 複数を受けるのは、《怪異》が共鳴感情を複数持つため。DLは「∞共鳴感情：
   * [憧憬（理想）][恨み（情念）]」の形でまとめて鳴らす
   */
  requested: readonly string[];
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
 *
 * 指定が複数あるときも同じで、**いずれか1つでも一致すれば成立**し、いちばん大きい
 * 一致度を採る。ルールブックの「重複せず大きい方のみ」を感情の数だけ広げた形で、
 * 多くの感情を持つ《怪異》ほど多くの共鳴者を鳴らせる。
 */
export function resolveEmotionMatch({
  owned,
  requested,
  attributeOf,
}: EmotionMatchParams): ResonanceMatch {
  if (requested.length === 0) return "none";

  if (requested.some((emotion) => owned.all.includes(emotion))) return "completely";

  if (!owned.root) return "none";

  const rootAttribute = attributeOf(owned.root);
  // 属性を引けない感情どうしを「どちらも undefined だから一致」にしない
  if (!rootAttribute) return "none";

  return requested.some((emotion) => attributeOf(emotion) === rootAttribute) ? "root" : "none";
}
