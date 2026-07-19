import type { DataSchema } from "@common/abstract/_types.mjs";

// Schemaは実行時には使われないが、サブクラスがdefineSchemaの型を宣言するために保持する
export class EmokloreSystemDataModel<_Schema extends DataSchema = DataSchema> extends foundry
  .abstract.TypeDataModel {}
