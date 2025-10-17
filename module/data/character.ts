import { BaseActorDataModel } from "./base-actor";
const { HTMLField, NumberField, SchemaField, StringField, BooleanField } = foundry.data.fields;

const defineCharacterDataModelSchema = () => {
  const schema: Record<string, foundry.data.fields.DataField> = {};

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
      value: new NumberField({ required: true, integer: true, initial: 1 }),
      max: new NumberField({ required: true, integer: true, initial: 9 }),
    }),
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
    Object.entries(CONFIG.EMOKLORE.characteristics).reduce(
      (obj, [chc, { label }]) => {
        (obj as Record<string, foundry.data.fields.DataField>)[chc] = new SchemaField({
          value: new NumberField({ ...characteristic, label }),
          mod: new SchemaField({
            bonus: new NumberField({ required: true, integer: true, initial: 0 }),
            success: new NumberField({ required: true, integer: true, initial: 0 }),
            target: new NumberField({ required: true, integer: true, initial: 0 }),
          }),
        });
        return obj;
      },
      {} as Record<string, foundry.data.fields.DataField>,
    ),
  );

  schema.skills = new SchemaField(
    Object.entries(CONFIG.EMOKLORE.skills).reduce(
      (obj, [skill, { characteristic, label, characteristicOptions, group, isExtra }]) => {
        (obj as Record<string, foundry.data.fields.DataField>)[skill] = new SchemaField({
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
            initial: characteristicOptions?.[0] ?? characteristic,
            ...(characteristicOptions
              ? {
                  choices: Object.fromEntries(
                    characteristicOptions.map((key) => [
                      key,
                      game.i18n.localize(`EMOKLORE.Actor.characteristics.${String(key)}`),
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
          }),
        });
        return obj;
      },
      {} as Record<string, foundry.data.fields.DataField>,
    ),
  );

  schema.baseSkills = new SchemaField(
    Object.entries(CONFIG.EMOKLORE.baseSkills).reduce(
      (obj, [skill, { characteristic, label, group }]) => {
        (obj as Record<string, foundry.data.fields.DataField>)[skill] = new SchemaField({
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
          }),
        });
        return obj;
      },
      {} as Record<string, foundry.data.fields.DataField>,
    ),
  );

  schema.skillGroups = new SchemaField(
    Object.entries(CONFIG.EMOKLORE.skillGroups).reduce(
      (obj, [group, { label }]) => {
        (obj as Record<string, foundry.data.fields.DataField>)[group] = new SchemaField({
          label: new StringField({ initial: game.i18n.localize(label) }),
          mod: new SchemaField({
            bonus: new NumberField({ required: true, integer: true, initial: 0 }),
            success: new NumberField({ required: true, integer: true, initial: 0 }),
            target: new NumberField({ required: true, integer: true, initial: 0 }),
          }),
        });
        return obj;
      },
      {} as Record<string, foundry.data.fields.DataField>,
    ),
  );

  schema.emotions = new SchemaField({
    surface: new StringField(),
    hidden: new StringField(),
    root: new StringField(),
  });

  schema.biography = new SchemaField({
    age: new StringField(),
    gender: new StringField(),
    occupation: new StringField(),
    hometown: new StringField(),
    appearance: new StringField(),
    personality: new StringField(),
    background: new StringField(),
    importantPeople: new StringField(),
    likesAndDislikes: new StringField(),
    note: new HTMLField({ required: true, blank: true }),
  });

  return schema;
};

export type CharacterDataModelSchema = ReturnType<typeof defineCharacterDataModelSchema>;

export class CharacterDataModel extends BaseActorDataModel<CharacterDataModelSchema> {
  declare skills: Record<
    keyof (typeof CONFIG.EMOKLORE)["skills"],
    {
      level: number;
      characteristic: keyof (typeof CONFIG.EMOKLORE)["characteristics"];
      target?: number;
    }
  >;

  declare baseSkills: Record<
    keyof (typeof CONFIG.EMOKLORE)["baseSkills"],
    {
      characteristic: keyof (typeof CONFIG.EMOKLORE)["characteristics"];
      target?: number;
    }
  >;

  declare resources: {
    hp: { value: number; max: number };
    mp: { value: number; max: number };
    resonance: { value: number; max: number };
  };

  declare characteristics: Record<
    keyof (typeof CONFIG.EMOKLORE)["characteristics"],
    {
      value: number;
      mod: {
        bonus: number;
        success: number;
        target: number;
      };
    }
  >;

  declare skillGroups: Record<
    keyof (typeof CONFIG.EMOKLORE)["skillGroups"],
    {
      label: string;
      mod: {
        bonus: number;
        success: number;
        target: number;
      };
    }
  >;

  declare emotions: {
    surface?: string;
    hidden?: string;
    root?: string;
  };

  declare biography: {
    age?: string;
    gender?: string;
    occupation?: string;
    hometown?: string;
    appearance?: string;
    personality?: string;
    background?: string;
    importantPeople?: string;
    likesAndDislikes?: string;
    note: string;
  };

  static override defineSchema() {
    return defineCharacterDataModelSchema();
  }

  static override LOCALIZATION_PREFIXES = ["EMOKLORE.Actor.character"];

  override prepareDerivedData() {
    super.prepareDerivedData();

    this.skills = Object.fromEntries(
      Object.entries(this.skills).map(([key, skill]) => [
        key,
        {
          ...skill,
          target:
            skill.level +
            (foundry.utils.getProperty(
              this,
              `characteristics.${String(skill.characteristic)}.value`,
            ) as number),
        },
      ]),
    );

    this.baseSkills = Object.fromEntries(
      Object.entries(this.baseSkills).map(([key, skill]) => [
        key,
        {
          ...skill,
          target: foundry.utils.getProperty(
            this,
            `characteristics.${String(skill.characteristic)}.value`,
          ) as number,
        },
      ]),
    );

    this.baseSkills.treatment.target = Math.ceil(this.baseSkills.treatment.target / 2);

    this.resources.hp.max =
      10 + (foundry.utils.getProperty(this, "characteristics.physical.value") as number);
    this.resources.hp.value = Math.min(this.resources.hp.value, this.resources.hp.max);

    this.resources.mp.max =
      (foundry.utils.getProperty(this, "characteristics.mentality.value") as number) +
      (foundry.utils.getProperty(this, "characteristics.intelligence.value") as number);
    this.resources.mp.value = Math.min(this.resources.mp.value, this.resources.mp.max);

    this.resources.resonance.value = Math.max(this.resources.resonance.value, 1);
  }
}
