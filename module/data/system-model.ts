/**
 * Actor / Item / ChatMessage 共通のTypeDataModel基底。
 *
 * かつてスキーマの型を型引数で持っていたが、クラス本体で一度も使われておらず、
 * 渡していた型の実体も `Record<string, DataField>` で情報を持っていなかった。
 * つまり安全性の錯覚だけがあった。
 *
 * 本体のフィールドクラス（`common/data/fields.mjs`）は `ArrayField` を除いて
 * ジェネリックではないので、スキーマ定義からデータの型を導く道はそもそも無い。
 * フィールドの型はサブクラスの `declare` が正で、スキーマとの一致は人が保つ。
 */
export class EmokloreSystemDataModel extends foundry.abstract.TypeDataModel {
  static override defineSchema(): Record<string, foundry.data.fields.DataField> {
    return {};
  }
}
