import { BaseActorDataModel } from "./base-actor";
const { HTMLField, NumberField, SchemaField, StringField } = foundry.data.fields;

export class NpcDataModel extends BaseActorDataModel {
  declare wickedness: {
    value: number;
    max: number;
  };

  static override defineSchema(): Record<string, unknown> {
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
