import { EmokloreActor } from "../documents/actor";

export class BaseActorDataModel<Schema extends foundry.data.fields.DataSchema> extends foundry
  .abstract.TypeDataModel<Schema, EmokloreActor> {
  static override defineSchema(): Record<string, foundry.data.fields.DataField> {
    const schema: Record<string, foundry.data.fields.DataField> = {};
    return schema;
  }
}
