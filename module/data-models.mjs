const { HTMLField, NumberField, SchemaField, StringField } = foundry.data.fields;

/* -------------------------------------------- */
/*  Actor Models                                */
/* -------------------------------------------- */

  class ActorDataModel extends foundry.abstract.TypeDataModel {
    static defineSchema() {

      const schema = {};

      schema.resources = new SchemaField({
        health: new SchemaField({
          min: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
          value: new NumberField({ required: true, integer: true, min: 0, initial: 10 }),
          max: new NumberField({ required: true, integer: true, min: 0, initial: 10 })
        }),
        power: new SchemaField({
          min: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
          value: new NumberField({ required: true, integer: true, min: 0, initial: 1 }),
          max: new NumberField({ required: true, integer: true, min: 0, initial: 3 })
        })
      })
      return schema
    };
  }

class EmokloreActorDataModel extends ActorDataModel {
  static defineSchema() {
    const schema = super.defineSchema();

    schema.background = new SchemaField({
      biography: new HTMLField({ required: true, blank: true }),
      hairColor: new StringField({ required: true, blank: true })
    })

    return schema;
  }
}

export class CharacterDataModel extends EmokloreActorDataModel {
  static defineSchema() {
    const schema = super.defineSchema();

    schema.goodness = new SchemaField({
      value: new NumberField({ required: true, integer: true, min: 0, initial: 5 }),
      max: new NumberField({ required: true, integer: true, min: 0, initial: 10 })
    })

    schema.level = new NumberField({ required: true, integer: true, min: 0, initial: 0, max: 30 })

    const characteristic = { min: 1, max: 6, initial: 1, integer: true, required: true, nullable: false };

    schema.characteristics = new SchemaField(
      Object.entries(CONFIG.EMOKLORE.characteristics).reduce((obj, [chc, { label }]) => {
        obj[chc] = new NumberField({ ...characteristic, label });
        return obj;
      }, {}),
    );

    return schema;
  }

  prepareDerivedData() {
    super.prepareDerivedData();

    this.baseSkills = Object.fromEntries(
      Object.entries(CONFIG.EMOKLORE.baseSkills).map(([key, skill]) => [
        key,
        {
          ...skill,
          target: foundry.utils.getProperty(this, `characteristics.${skill.characteristic}`),
          level: 3
        }
      ])
    );
   }
}

export class NpcDataModel extends EmokloreActorDataModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      wickedness: new SchemaField({
        value: new NumberField({ required: true, integer: true, min: 0, initial: 5 }),
        max: new NumberField({ required: true, integer: true, min: 0, initial: 100 })
      })
    };
  }
}

// The pawn does not have any different data to the base ActorDataModel, but we
// still define a data model for it, in case we have any special logic we want
// to perform only for pawns.
  export class PawnDataModel extends ActorDataModel {}

/* -------------------------------------------- */
/*  Item Models                                 */
/* -------------------------------------------- */

  class ItemDataModel extends foundry.abstract.TypeDataModel {
    static defineSchema() {
      return {
        rarity: new StringField({
          required: true,
          blank: false,
          options: ["common", "uncommon", "rare", "legendary"],
          initial: "common"
        }),
        price: new NumberField({ required: true, integer: true, min: 0, initial: 20 })
      };
    }
  }

export class WeaponDataModel extends ItemDataModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      damage: new NumberField({ required: true, integer: true, positive: true, initial: 5 })
    };
  }
}

export class SpellDataModel extends ItemDataModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      cost: new NumberField({ required: true, integer: true, positive: true, initial: 2 })
    };
  }
}
