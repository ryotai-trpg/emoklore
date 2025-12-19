import { EmokloreSystemDataModel } from "./system-model";
const { HTMLField, NumberField, SchemaField, StringField } = foundry.data.fields;

/* -------------------------------------------- */
/*  Item Models                                 */
/* -------------------------------------------- */

const defineBaseItemDataModelSchema = () => {
  return {};
};

export type BaseItemDataModelSchema = ReturnType<typeof defineBaseItemDataModelSchema>;

export class BaseItemDataModel extends EmokloreSystemDataModel<BaseItemDataModelSchema> {
  static override defineSchema() {
    return defineBaseItemDataModelSchema();
  }
}

const defineWeaponDataModelSchema = () => {
  return {
    ...defineBaseItemDataModelSchema(),
    rangeType: new StringField({
      required: true,
      blank: false,
      options: ["melee", "ranged"],
      initial: "melee",
    }),
    attackPower: new StringField({
      required: false,
      blank: true,
      initial: "",
    }),
    range: new StringField({
      required: false,
      blank: true,
      initial: "",
    }),
    notes: new HTMLField({
      required: false,
      blank: true,
      initial: "",
    }),
  };
};

export type WeaponDataModelSchema = ReturnType<typeof defineWeaponDataModelSchema>;

export class WeaponDataModel extends BaseItemDataModel {
  static override defineSchema() {
    return defineWeaponDataModelSchema();
  }
}
