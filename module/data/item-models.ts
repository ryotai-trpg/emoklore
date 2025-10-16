import { EmokloreSystemDataModel } from "./system-model";
const { HTMLField, NumberField, SchemaField, StringField } = foundry.data.fields;

/* -------------------------------------------- */
/*  Item Models                                 */
/* -------------------------------------------- */

class BaseItemDataModel extends EmokloreSystemDataModel {
  declare rarity: string;
  declare price: number;

  static defineSchema(): Record<string, unknown> {
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
  }
}

export class WeaponDataModel extends BaseItemDataModel {
  declare damage: number;

  static override defineSchema(): Record<string, unknown> {
    return {
      ...super.defineSchema(),
      damage: new NumberField({
        required: true,
        integer: true,
        positive: true,
        initial: 5,
      }),
    };
  }
}
