/**
 * キーが有限に決まっているオブジェクトを、キーの型を保ったまま回す。
 *
 * 本体の `Object.entries` は `[string, V][]` を返すので、CONFIG.EMOKLORE の
 * ような literal キーの表を回すたびに、1行前まで分かっていたキーを
 * `as SkillKey` と名乗り直すことになる。キャストを呼び出しごとに
 * 散らすかわりに、ここ1箇所に閉じ込める。
 *
 * `Object.entries` が返すのは自身の列挙可能な文字列キーなので、型が持つキーと
 * 実体がずれていなければ結果は `keyof T` に収まる。構造的部分型で余分な
 * プロパティを持つ値を渡した場合はこの限りではない。
 */
export const typedEntries = <T extends object>(obj: T): [keyof T, T[keyof T]][] =>
  Object.entries(obj) as [keyof T, T[keyof T]][];
