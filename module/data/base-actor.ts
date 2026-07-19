import type { DataSchema } from "@common/abstract/_types.mjs";

export class BaseActorDataModel<_Schema extends DataSchema = DataSchema> extends foundry.abstract
  .TypeDataModel {
  static override defineSchema(): Record<string, foundry.data.fields.DataField> {
    const schema: Record<string, foundry.data.fields.DataField> = {};
    return schema;
  }
}
