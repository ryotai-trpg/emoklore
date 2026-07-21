import { type BaseSkillKey, isBaseSkillKey } from "../config/base-skills";
import type { CharacteristicKey } from "../config/characteristics";
import type { SkillGroupKey } from "../config/skill-groups";
import { isSkillKey, type SkillKey } from "../config/skills";
import {
  calculateBaseSkillTarget,
  calculateInitiative,
  calculateMaxHp,
  calculateMaxMp,
  calculateSkillTarget,
  clampToMax,
  normalizeResonance,
} from "../rules/derived-values";
import {
  CHARACTERISTIC_MAX,
  CHARACTERISTIC_MIN,
  SKILL_LEVEL_MAX,
  SKILL_LEVEL_MIN,
} from "../rules/limits";
import type { SkillRollParams } from "../rules/skill-roll";
import type { ModifierSet } from "../rules/types";
import { typedEntries } from "../utils/object";
import { EmokloreSystemDataModel } from "./system-model";

const { HTMLField, NumberField, SchemaField, StringField } = foundry.data.fields;

/**
 * どの技能を振るか。
 *
 * 技能と基本技能は別の表にあり、キーの集合も違う。かつては
 * `(skill: string, { base: boolean })` の組で渡していたが、これだと
 * 「base: true に通常技能のキー」という有り得ない組み合わせが型で作れてしまい、
 * 受け取った側は as で名乗り直すしかなかった。判別可能unionにして、
 * 種別とキーが必ず対応するようにする。
 */
export type SkillRef = { kind: "skill"; key: SkillKey } | { kind: "base"; key: BaseSkillKey };

/**
 * 外から来た文字列を SkillRef に変える。キーとして通らなければ null。
 *
 * 種別が実行時にしか決まらない呼び出し側（武器カードなど）が使う。
 * どちらの表を見るか静的に分かっているなら、型述語を直に使えばよい。
 */
export const resolveSkillRef = (key: string, { base }: { base: boolean }): SkillRef | null => {
  if (base) return isBaseSkillKey(key) ? { kind: "base", key } : null;
  return isSkillKey(key) ? { kind: "skill", key } : null;
};

/** 技能判定に必要な、アクターから集めた一式 */
export type SkillRollContext = {
  params: SkillRollParams;
  label: string;
  /** 基本技能なら true。チャットの見出しに「＊」を付けるかがこれで決まる */
  isBase: boolean;
  isExtra: boolean;
  specialization?: string | undefined;
};

/**
 * 技能・能力値・技能グループが共通で持つ修正値の組。
 *
 * 型の側は rules/types.ts の ModifierSet が持っている。スキーマ側だけ4箇所に
 * コピーされていたので、対応が1対1になるようここへ寄せた。
 */
const modifierField = () =>
  new SchemaField({
    bonus: new NumberField({ required: true, integer: true, initial: 0 }),
    success: new NumberField({ required: true, integer: true, initial: 0 }),
    target: new NumberField({ required: true, integer: true, initial: 0 }),
  });

// 能力値の NumberField に渡す共通オプション。技能側で分割代入する
// characteristic（能力値キーの文字列）とは別物なので名前を分けている
const characteristicFieldOptions = {
  min: CHARACTERISTIC_MIN,
  max: CHARACTERISTIC_MAX,
  initial: 1,
  integer: true,
  required: true,
  nullable: false,
};

const defineCharacterDataModelSchema = () => ({
  resources: new SchemaField({
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
  }),

  characteristics: new SchemaField(
    Object.fromEntries(
      typedEntries(CONFIG.EMOKLORE.characteristics).map(([chc]) => [
        chc,
        new SchemaField({
          // label は指定しない。定義時に設定すると localizeSchema の `this.label ||= ...` に
          // 勝ってしまい、ja.json の FIELDS 側の指定が効かなくなる
          value: new NumberField({ ...characteristicFieldOptions }),
          mod: modifierField(),
        }),
      ]),
    ),
  ),

  skills: new SchemaField(
    Object.fromEntries(
      typedEntries(CONFIG.EMOKLORE.skills).map(
        ([skill, { characteristic, characteristicOptions, hasSpecialization }]) => [
          skill,
          new SchemaField({
            level: new NumberField({
              min: SKILL_LEVEL_MIN,
              max: SKILL_LEVEL_MAX,
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
            mod: modifierField(),
          }),
        ],
      ),
    ),
  ),

  baseSkills: new SchemaField(
    Object.fromEntries(
      typedEntries(CONFIG.EMOKLORE.baseSkills).map(([skill, { characteristic }]) => [
        skill,
        new SchemaField({
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
          mod: modifierField(),
        }),
      ]),
    ),
  ),

  skillGroups: new SchemaField(
    Object.fromEntries(
      typedEntries(CONFIG.EMOKLORE.skillGroups).map(([group]) => [
        group,
        new SchemaField({
          // label は保存しない。ここで game.i18n.localize した結果を initial に焼き込んでいたため、
          // アクター作成後に言語を切り替えても古いラベルが残っていた
          mod: modifierField(),
        }),
      ]),
    ),
  ),

  emotions: new SchemaField({
    surface: new StringField(),
    hidden: new StringField(),
    root: new StringField(),
  }),

  biography: new SchemaField({
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
  }),
});

export class CharacterDataModel extends EmokloreSystemDataModel {
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
  getSkillRollContext(ref: SkillRef): SkillRollContext {
    if (ref.kind === "base") {
      const { label, group } = CONFIG.EMOKLORE.baseSkills[ref.key];
      // 基本技能に isExtra / specialization はない
      return {
        params: this.#toRollParams(this.baseSkills[ref.key], group),
        label,
        isBase: true,
        isExtra: false,
      };
    }

    const { label, group, isExtra } = CONFIG.EMOKLORE.skills[ref.key];
    const entry = this.skills[ref.key];

    return {
      params: this.#toRollParams(entry, group),
      label,
      isBase: false,
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
    group: SkillGroupKey,
  ): SkillRollParams {
    return {
      level: entry.level,
      baseTarget: entry.target,
      skillMod: entry.mod,
      characteristicMod: this.characteristics[entry.characteristic].mod,
      skillGroupMod: this.skillGroups[group].mod,
    };
  }

  modifyRollData(rollData: Record<string, unknown>): void {
    rollData.initiative = this.initiative;
  }
}
