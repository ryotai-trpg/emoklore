import { EmokloreSystemDataModel } from "./system-model";
const { HTMLField, NumberField, SchemaField, StringField } = foundry.data.fields;

/* -------------------------------------------- */
/*  Item Models                                 */
/* -------------------------------------------- */

const defineBaseItemDataModelSchema = () => {
  return {
    rarity: new StringField({
      required: true,
      blank: false,
      options: ["common", "uncommon", "rare", "legendary"],
      initial: "common",
    }),
    price: new NumberField({
      required: true,
      integer: true,
      min: 0,
      initial: 20,
    }),
  };
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
    damage: new NumberField({
      required: true,
      integer: true,
      positive: true,
      initial: 5,
    }),
  };
};

export type WeaponDataModelSchema = ReturnType<typeof defineWeaponDataModelSchema>;

export class WeaponDataModel extends BaseItemDataModel {
  static override defineSchema() {
    return defineWeaponDataModelSchema();
  }
}
