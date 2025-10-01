const { HTMLField, NumberField, SchemaField, StringField } = foundry.data.fields;

/* -------------------------------------------- */
/*  Actor Models                                */
/* -------------------------------------------- */

  class ActorDataModel extends foundry.abstract.TypeDataModel {
    static defineSchema() {
      // All Actors have resources.
        return {
          resources: new SchemaField({
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
        };
    }
  }

class EmokloreActorDataModel extends ActorDataModel {
  static defineSchema() {
    // Only important Actors have a background and hair color.
      return {
        ...super.defineSchema(),
          background: new SchemaField({
            biography: new HTMLField({ required: true, blank: true }),
            hairColor: new StringField({ required: true, blank: true })
          })
      };
  }
}

export class CharacterDataModel extends EmokloreActorDataModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      goodness: new SchemaField({
        value: new NumberField({ required: true, integer: true, min: 0, initial: 5 }),
        max: new NumberField({ required: true, integer: true, min: 0, initial: 10 })
      }),
      level: new NumberField({ required: true, integer: true, min: 0, initial: 0, max: 30 }),
      characteristics: new SchemaField({
        physical: new NumberField({ required: true, integer: true, min: 1, max: 6, initial: 1, label: "EMOKLORE.Actor.characteristics.physical" }),
        dexterity: new NumberField({ required: true, integer: true, min: 1, max: 6, initial: 1, label: "EMOKLORE.Actor.characteristics.dexterity" }),
        mentality: new NumberField({ required: true, integer: true, min: 1, max: 6, initial: 1, label: "EMOKLORE.Actor.characteristics.mentality" }),
        sensitivity: new NumberField({ required: true, integer: true, min: 1, max: 6, initial: 1, label: "EMOKLORE.Actor.characteristics.sensitivity" }),
        intelligence: new NumberField({ required: true, integer: true, min: 1, max: 6, initial: 1, label: "EMOKLORE.Actor.characteristics.intelligence" }),
        charisma: new NumberField({ required: true, integer: true, min: 1, max: 6, initial: 1, label: "EMOKLORE.Actor.characteristics.charisma" }),
        sociality: new NumberField({ required: true, integer: true, min: 1, max: 6, initial: 1, label: "EMOKLORE.Actor.characteristics.sociality" }),
        luck: new NumberField({ required: true, integer: true, min: 1, max: 6, initial: 1, label: "EMOKLORE.Actor.characteristics.luck" }),
      })
    };
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
