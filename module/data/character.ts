import type { BaseSkillKey } from "../config/base-skills";
import type { CharacteristicKey } from "../config/characteristics";
import type { SkillGroupKey } from "../config/skill-groups";
import type { SkillKey } from "../config/skills";
import type { SkillRollParams } from "../rules/skill-roll";
import type { ModifierSet } from "../rules/types";
import { EmokloreSystemDataModel } from "./system-model";

const { HTMLField, NumberField, SchemaField, StringField, BooleanField } = foundry.data.fields;

/** 技能判定に必要な、アクターから集めた一式 */
export type SkillRollContext = {
  params: SkillRollParams;
  label: string;
  isExtra: boolean;
  specialization?: string;
};

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
      (
        obj,
        [
          skill,
          { characteristic, label, characteristicOptions, group, isExtra, hasSpecialization },
        ],
      ) => {
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
          hasSpecialization: new BooleanField({ initial: hasSpecialization ?? false }),
          ...(hasSpecialization ? { specialization: new StringField({ initial: "" }) } : {}),
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

export class CharacterDataModel extends EmokloreSystemDataModel<CharacterDataModelSchema> {
  // target は prepareDerivedData で必ず設定される派生値（initiative と同じ扱い）。
  // それ以外は defineCharacterDataModelSchema のスキーマと一致させること
  declare skills: Record<
    SkillKey,
    {
      level: number;
      characteristic: CharacteristicKey;
      label: string;
      group: SkillGroupKey;
      isExtra: boolean;
      hasSpecialization: boolean;
      specialization?: string;
      mod: ModifierSet;
      target: number;
    }
  >;

  declare baseSkills: Record<
    BaseSkillKey,
    {
      level: number;
      characteristic: CharacteristicKey;
      label: string;
      group: SkillGroupKey;
      mod: ModifierSet;
      target: number;
    }
  >;

  declare resources: {
    hp: { value: number; max: number };
    mp: { value: number; max: number };
    resonance: { value: number; max: number };
  };

  declare characteristics: Record<
    CharacteristicKey,
    {
      value: number;
      mod: ModifierSet;
    }
  >;

  declare skillGroups: Record<
    SkillGroupKey,
    {
      label: string;
      mod: ModifierSet;
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

  declare initiative: number;

  static override defineSchema() {
    return defineCharacterDataModelSchema();
  }

  static override LOCALIZATION_PREFIXES = ["EMOKLORE.Actor.character"];

  override prepareDerivedData() {
    super.prepareDerivedData();

    for (const skill of Object.values(this.skills)) {
      skill.target = skill.level + this.characteristics[skill.characteristic].value;
    }

    for (const skill of Object.values(this.baseSkills)) {
      skill.target = this.characteristics[skill.characteristic].value;
    }

    // 〈手当〉のみ能力値の半分（切り上げ）が目標値になる
    this.baseSkills.treatment.target = Math.ceil(this.baseSkills.treatment.target / 2);

    this.resources.hp.max = 10 + this.characteristics.physical.value;
    this.resources.hp.value = Math.min(this.resources.hp.value, this.resources.hp.max);

    this.resources.mp.max =
      this.characteristics.mentality.value + this.characteristics.intelligence.value;
    this.resources.mp.value = Math.min(this.resources.mp.value, this.resources.mp.max);

    this.resources.resonance.value = Math.max(this.resources.resonance.value, 1);

    this.initiative = this.characteristics.physical.value + this.skills.speed.level;
  }

  /**
   * 技能判定に必要な値をアクターから集める。
   *
   * 判定式そのものは rules/skill-roll.ts が持つ。ここはあくまで
   * 「どの値を渡すか」を決めるだけで、表示用の整形は呼び出し側に任せる。
   */
  getSkillRollContext(skill: string, { base = false } = {}): SkillRollContext {
    // シートのdatasetから来る文字列なので、キーであることはここで引き受ける
    if (base) {
      // 基本技能に isExtra / specialization はない
      const entry = this.baseSkills[skill as BaseSkillKey];
      return { params: this.#toRollParams(entry), label: entry.label, isExtra: false };
    }

    const entry = this.skills[skill as SkillKey];
    return {
      params: this.#toRollParams(entry),
      label: entry.label,
      isExtra: entry.isExtra,
      specialization: entry.specialization,
    };
  }

  /** 技能・基本技能に共通する、判定に効く値の取り出し */
  #toRollParams(entry: {
    level: number;
    target: number;
    characteristic: CharacteristicKey;
    group: SkillGroupKey;
    mod: ModifierSet;
  }): SkillRollParams {
    return {
      level: entry.level,
      baseTarget: entry.target,
      skillMod: entry.mod,
      characteristicMod: this.characteristics[entry.characteristic].mod,
      skillGroupMod: this.skillGroups[entry.group].mod,
    };
  }

  modifyRollData(rollData: Record<string, unknown>): void {
    rollData.initiative = this.initiative;
  }
}
