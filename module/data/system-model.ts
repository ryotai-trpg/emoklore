/**
 * Actor / Item / ChatMessage 共通のTypeDataModel基底。
 *
 * スキーマの型を型引数で持ち回さない。本体のフィールドクラス（`common/data/fields.mjs`）は
 * `ArrayField` を除いてジェネリックではないので、スキーマ定義からデータの型を導く道が無く、
 * 型引数はどこも制約しない安全性の錯覚になる。
 * フィールドの型はサブクラスの `declare` が正で、スキーマとの一致は人が保つ。
 */
export class EmokloreSystemDataModel extends foundry.abstract.TypeDataModel {
  static override defineSchema(): Record<string, foundry.data.fields.DataField> {
    return {};
  }
}
