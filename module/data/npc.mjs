import { BaseActorDataModel } from "./base-actor.mjs";
const { HTMLField, NumberField, SchemaField, StringField } = foundry.data.fields;

export class NpcDataModel extends BaseActorDataModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      wickedness: new SchemaField({
        value: new NumberField({
          required: true,
          integer: true,
          min: 0,
          initial: 5,
        }),
        max: new NumberField({
          required: true,
          integer: true,
          min: 0,
          initial: 100,
        }),
      }),
    };
  }
}
