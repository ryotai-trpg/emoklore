import { BaseActorDataModel } from "./base-actor.mjs";
const { HTMLField, NumberField, SchemaField, StringField, BooleanField } = foundry.data.fields;

export class CharacterDataModel extends BaseActorDataModel {
  static defineSchema() {
    const schema = super.defineSchema();

    schema.resources = new SchemaField({
      hp: new SchemaField({
        value: new NumberField({ required: true, integer: true, initial: 11 }),
        max: new NumberField({ required: true, integer: true, initial: 11 }),
      }),
      mp: new SchemaField({
        value: new NumberField({ required: true, integer: true, initial: 2 }),
        max: new NumberField({ required: true, integer: true, initial: 2 }),
      }),
      resonance: new SchemaField({
        value: new NumberField({ required: true, interger: true, initial: 1}),
        max: new NumberField({ required: true, interger: true, initial: 9}),
      })
    });

    const characteristic = {
      min: 1,
      max: 6,
      initial: 1,
      integer: true,
      required: true,
      nullable: false,
    };

    schema.characteristics = new SchemaField(
      Object.entries(CONFIG.EMOKLORE.characteristics).reduce((obj, [chc, { label }]) => {
        obj[chc] = new SchemaField({
          value: new NumberField({ ...characteristic, label }),
          mod: new SchemaField({
            bonus: new NumberField({ required: true, integer: true, initial: 0 }),
            success: new NumberField({ required: true, integer: true, initial: 0 }),
            target: new NumberField({ required: true, integer: true, initial: 0 }),
          })
        });
        return obj;
      }, {}),
    );

    schema.skills = new SchemaField(
      Object.entries(CONFIG.EMOKLORE.skills).reduce(
        (obj, [skill, { characteristic, label, characteristicOptions, group, isExtra }]) => {
          obj[skill] = new SchemaField({
            level: new NumberField({
              min: 0,
              max: 3,
              initial: 0,
              integer: true,
              required: true,
              nullable: false,
            }),
            characteristic: new StringField({
              required: true,
              // initial: characteristic,
              initial: characteristicOptions?.[0] ?? characteristic,
              ...(characteristicOptions
                ? {
                    choices: Object.fromEntries(
                      characteristicOptions.map((key) => [
                        key,
                        game.i18n.localize(`EMOKLORE.Actor.characteristics.${key}`),
                      ]),
                    ),
                  }
                : {}),
            }),
            label: new StringField({ initial: label }),
            group: new StringField({ initial: group }),
            isExtra: new BooleanField({ initial: isExtra ?? false }),
            mod: new SchemaField({
              bonus: new NumberField({ required: true, integer: true, initial: 0 }),
              success: new NumberField({ required: true, integer: true, initial: 0 }),
              target: new NumberField({ required: true, integer: true, initial: 0 }),
            })
          });
          return obj;
        },
        {},
      ),
    );

    schema.baseSkills = new SchemaField(
      Object.entries(CONFIG.EMOKLORE.baseSkills).reduce(
        (obj, [skill, { characteristic, label, group }]) => {
          obj[skill] = new SchemaField({
            level: new NumberField({
              min: 1,
              max: 1,
              initial: 1,
              integer: true,
              required: true,
              nullable: false,
            }),
            characteristic: new StringField({
              required: true,
              initial: characteristic,
            }),
            label: new StringField({ initial: label }),
            group: new StringField({ initial: group }),
            mod: new SchemaField({
              bonus: new NumberField({ required: true, integer: true, initial: 0 }),
              success: new NumberField({ required: true, integer: true, initial: 0 }),
              target: new NumberField({ required: true, integer: true, initial: 0 }),
            })
          });
          return obj;
        },
        {},
      ),
    );

    schema.skillGroups = new SchemaField(
      Object.entries(CONFIG.EMOKLORE.skillGroups).reduce((obj, [group, { label }]) => {
        obj[group] = new SchemaField({
          label: new StringField({ initial: game.i18n.localize(label) }),
          mod: new SchemaField({
            bonus: new NumberField({ required: true, integer: true, initial: 0 }),
            success: new NumberField({ required: true, integer: true, initial: 0 }),
            target: new NumberField({ required: true, integer: true, initial: 0 }),
          })
        });
        return obj;
      }, {}),
    );

    schema.emotions = new SchemaField({
      surface: new StringField(),
      hidden: new StringField(),
      root: new StringField(),
    });

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
    });

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
          target:
            skill.level +
            foundry.utils.getProperty(this, `characteristics.${skill.characteristic}.value`),
        },
      ]),
    );

    this.baseSkills = Object.fromEntries(
      Object.entries(this.baseSkills).map(([key, skill]) => [
        key,
        {
          ...skill,
          target: foundry.utils.getProperty(this, `characteristics.${skill.characteristic}.value`),
        },
      ]),
    );

    this.resources.hp.max = 10 + foundry.utils.getProperty(this, "characteristics.physical.value");
    this.resources.hp.value = Math.min(this.resources.hp.value, this.resources.hp.max);

    this.resources.mp.max =
      foundry.utils.getProperty(this, "characteristics.mentality.value") +
      foundry.utils.getProperty(this, "characteristics.intelligence.value");
    this.resources.mp.value = Math.min(this.resources.mp.value, this.resources.mp.max);

    this.resources.resonance.value = Math.max(this.resources.resonance.value, 1);
  }
}
