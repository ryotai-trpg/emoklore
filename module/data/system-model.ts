// class AbstractActorDataModel<Schema extends foundry.data.fields.DataSchema> extends foundry.abstract.TypeDataModel<
import type { EmokloreActor } from "../documents/actor";

export class EmokloreSystemDataModel<Schema extends foundry.data.fields.DataSchema> extends foundry
  .abstract.TypeDataModel<Schema, EmokloreActor> {}
