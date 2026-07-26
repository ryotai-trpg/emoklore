/**
 * 値の並べ方。
 *
 * 装飾込みのフォーマット（「〈{name}〉」「Lv.{level}」）は `lang/*.json` の
 * `EMOKLORE.Format.*` が持つので、ここが持つのは**繰り返して並べる**ぶんだけになる。
 * 反復はフォーマット文字列で書けないため、ここだけコードの側に残る。
 */

/**
 * 詰めて並べる。「身体／器用」「怒り（情念）／恨み（情念）」。
 *
 * ルールブックは【身体 or 器用】と書くが、シートの列は狭いので区切りだけにしている。
 * 本体の `getListFormatter` を使わないのはこのため（あちらは「AまたはB」と語を足す）。
 */
export const joinCompact = (values: Iterable<string>): string =>
  [...values].join(_loc("EMOKLORE.Format.separator"));

/**
 * 文章に混ぜて読ませる列挙。「AとB」「A、B、C」。
 *
 * 本体の `getListFormatter`（`Intl.ListFormat`）に任せる。区切りを自前で持つと、
 * 言語ごとに変わる語順と約物を表現できない。
 */
export const joinList = (values: Iterable<string>): string =>
  game.i18n.getListFormatter().format([...values]);
