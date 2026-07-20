import { EmokloreSystemDataModel } from "./system-model";

const { NumberField, SchemaField } = foundry.data.fields;

const defineNpcDataModelSchema = () => ({
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
});

export class NpcDataModel extends EmokloreSystemDataModel {
  declare wickedness: {
    value: number;
    max: number;
  };

  static override defineSchema() {
    return defineNpcDataModelSchema();
  }
}
