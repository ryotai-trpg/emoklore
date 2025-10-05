import { BaseActorDataModel } from "./base-actor.mjs";
const { HTMLField, NumberField, SchemaField, StringField } = foundry.data.fields;

export class CharacterDataModel extends BaseActorDataModel {
  static defineSchema() {
    const schema = super.defineSchema();

    schema.resources = new SchemaField({
      hp: new SchemaField({
        value: new NumberField({ required: true, integer: true, initial: 11 }),
        max: new NumberField({ required: true, integer: true, initial: 11 })
      }),
      mp: new SchemaField({
        value: new NumberField({ required: true, integer: true, initial: 2 }),
        max: new NumberField({ required: true, integer: true, initial: 2 })
      })
    })

    const characteristic = { 
      min: 1, max: 6, initial: 1, integer: true, required: true, nullable: false 
    };

    schema.characteristics = new SchemaField(
      Object.entries(CONFIG.EMOKLORE.characteristics).reduce((obj, [chc, {label} ]) => {
        obj[chc] = new NumberField({ ...characteristic, label });
        return obj;
      }, {}),
    );


    schema.skills = new SchemaField(
      Object.entries(CONFIG.EMOKLORE.skills).reduce((obj, [skill, { characteristic, label }]) => {
        obj[skill] = new SchemaField({
          level: new NumberField( { min: 0, max: 3, initial: 0, integer: true, required: true, nullable: false }),
          characteristic: new StringField({ required: true, initial: characteristic}),
          label: new StringField({ initial: label})
        });
        return obj;
      }, {}),
    );

    schema.emotions = new SchemaField({
      surface: new StringField(),
      hidden: new StringField(),
      root: new StringField(),
    })

    schema.biography = new SchemaField({
      age: new StringField({}),
      gender: new StringField({}),
      occupation: new StringField({}),
      hometown: new StringField({}),
      appearance: new StringField({}),
      personality: new StringField({}),
      background: new StringField({}),
      importantPeople: new StringField({}),
      likesAndDislikes: new StringField({}),
      note: new HTMLField({ required: true, blank: true }),
    })

    return schema;
  }

  static LOCALIZATION_PREFIXES = ["EMOKLORE.Actor.character"];

  prepareDerivedData() {
    super.prepareDerivedData();

    this.skills = Object.fromEntries(
      Object.entries(this.skills).map(([key, skill]) => [
        key,
        {
          ...skill,
          target: skill.level + foundry.utils.getProperty(this, `characteristics.${skill.characteristic}`)
        }
      ])
    );

    this.baseSkills = Object.fromEntries(
      Object.entries(CONFIG.EMOKLORE.baseSkills).map(([key, skill]) => [
        key,
        {
          ...skill,
          target: foundry.utils.getProperty(this, `characteristics.${skill.characteristic}`),
          level: 1
        }
      ])
    );

    this.resources.hp.max = 10 + foundry.utils.getProperty(this, "characteristics.physical");
    this.resources.hp.value = Math.min(this.resources.hp.value, this.resources.hp.max);

    this.resources.mp.max = foundry.utils.getProperty(this, "characteristics.mentality") + foundry.utils.getProperty(this, "characteristics.intelligence");
    this.resources.mp.value = Math.min(this.resources.mp.value, this.resources.mp.max);

  }
}
