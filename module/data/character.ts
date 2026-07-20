import type { BaseSkillKey } from "../config/base-skills";
import type { CharacteristicKey } from "../config/characteristics";
import type { SkillGroupKey } from "../config/skill-groups";
import type { SkillKey } from "../config/skills";
import {
  calculateBaseSkillTarget,
  calculateInitiative,
  calculateMaxHp,
  calculateMaxMp,
  calculateSkillTarget,
  clampToMax,
  normalizeResonance,
} from "../rules/derived-values";
import type { SkillRollParams } from "../rules/skill-roll";
import type { ModifierSet } from "../rules/types";
import { EmokloreSystemDataModel } from "./system-model";

const { HTMLField, NumberField, SchemaField, StringField } = foundry.data.fields;

/** 技能判定に必要な、アクターから集めた一式 */
export type SkillRollContext = {
  params: SkillRollParams;
  label: string;
  isExtra: boolean;
  specialization?: string | undefined;
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
      (obj, [chc]) => {
        (obj as Record<string, foundry.data.fields.DataField>)[chc] = new SchemaField({
          // label は指定しない。定義時に設定すると localizeSchema の `this.label ||= ...` に
          // 勝ってしまい、ja.json の FIELDS 側の指定が効かなくなる
          value: new NumberField({ ...characteristic }),
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
      (obj, [skill, { characteristic, characteristicOptions, hasSpecialization }]) => {
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
            // choices の値は翻訳済み文字列ではなくi18nキーを入れる。テンプレートが
            // formInput に localize=true を渡しており、描画時に本体が解決する。
            // ここで localize すると、スキーマ定義時に game.i18n へ依存してしまう
            ...(characteristicOptions
              ? {
                  choices: Object.fromEntries(
                    characteristicOptions.map((key) => [
                      key,
                      `EMOKLORE.Actor.characteristics.${key}`,
                    ]),
                  ),
                }
              : {}),
          }),
          // label / group / isExtra は CONFIG.EMOKLORE から引けるので保存しない
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
      (obj, [skill, { characteristic }]) => {
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
          // label / group は CONFIG.EMOKLORE から引けるので保存しない
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
      (obj, [group]) => {
        (obj as Record<string, foundry.data.fields.DataField>)[group] = new SchemaField({
          // label は保存しない。ここで game.i18n.localize した結果を initial に焼き込んでいたため、
          // アクター作成後に言語を切り替えても古いラベルが残っていた
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
      skill.target = calculateSkillTarget(
        skill.level,
        this.characteristics[skill.characteristic].value,
      );
    }

    // 〈手当〉の半減は calculateBaseSkillTarget が引き受ける。
    // ここで後から目標値を上書きしないので、ループを触っても連動して壊れない
    for (const [key, skill] of Object.entries(this.baseSkills)) {
      skill.target = calculateBaseSkillTarget(
        key,
        this.characteristics[skill.characteristic].value,
      );
    }

    const { hp, mp, resonance } = this.resources;
    hp.max = calculateMaxHp(this.characteristics.physical.value);
    hp.value = clampToMax(hp.value, hp.max);
    mp.max = calculateMaxMp(
      this.characteristics.mentality.value,
      this.characteristics.intelligence.value,
    );
    mp.value = clampToMax(mp.value, mp.max);
    resonance.value = normalizeResonance(resonance.value);

    this.initiative = calculateInitiative(
      this.characteristics.physical.value,
      this.skills.speed.level,
    );
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
      const key = skill as BaseSkillKey;
      const { label, group } = CONFIG.EMOKLORE.baseSkills[key];
      // 基本技能に isExtra / specialization はない
      return { params: this.#toRollParams(this.baseSkills[key], group), label, isExtra: false };
    }

    const key = skill as SkillKey;
    const { label, group, isExtra } = CONFIG.EMOKLORE.skills[key];
    const entry = this.skills[key];

    return {
      params: this.#toRollParams(entry, group),
      label,
      isExtra: isExtra ?? false,
      specialization: entry.specialization,
    };
  }

  /**
   * 技能・基本技能に共通する、判定に効く値の取り出し。
   *
   * 技能グループは保存データではなく CONFIG.EMOKLORE 側の定義なので引数で受ける。
   */
  #toRollParams(
    entry: {
      level: number;
      target: number;
      characteristic: CharacteristicKey;
      mod: ModifierSet;
    },
    group: string,
  ): SkillRollParams {
    return {
      level: entry.level,
      baseTarget: entry.target,
      skillMod: entry.mod,
      characteristicMod: this.characteristics[entry.characteristic].mod,
      skillGroupMod: this.skillGroups[group as SkillGroupKey].mod,
    };
  }

  modifyRollData(rollData: Record<string, unknown>): void {
    rollData.initiative = this.initiative;
  }
}
