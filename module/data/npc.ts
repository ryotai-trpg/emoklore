import { EmokloreSystemDataModel } from "./system-model";

const { NumberField, SchemaField } = foundry.data.fields;

const defineNpcDataModelSchema = () => {
  const schema: Record<string, foundry.data.fields.DataField> = {};

  schema.wickedness = new SchemaField({
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
  });

  return schema;
};

export type NpcDataModelSchema = ReturnType<typeof defineNpcDataModelSchema>;

export class NpcDataModel extends EmokloreSystemDataModel<NpcDataModelSchema> {
  declare wickedness: {
    value: number;
    max: number;
  };

  static override defineSchema() {
    return defineNpcDataModelSchema();
  }
}
