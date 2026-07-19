import type { DataSchema } from "@common/abstract/_types.mjs";

// Actor / Item 共通のTypeDataModel基底。
// Schemaは実行時には使われないが、サブクラスがdefineSchemaの型を宣言するために保持する
export class EmokloreSystemDataModel<_Schema extends DataSchema = DataSchema> extends foundry
  .abstract.TypeDataModel {
  static override defineSchema(): Record<string, foundry.data.fields.DataField> {
    return {};
  }
}
