import { type BaseSkillKey, isBaseSkillKey } from "../config/base-skills";
import type { CharacteristicKey } from "../config/characteristics";
import type { SkillGroupKey } from "../config/skill-groups";
import { isSkillKey, type SkillKey } from "../config/skills";
import { calculateArmorTotal } from "../rules/armor";
import {
  calculateBaseSkillTarget,
  calculateCustomSkillLevel,
  calculateCustomSkillTarget,
  calculateInitiative,
  calculateMaxHp,
  calculateMaxMp,
  calculateSkillTarget,
  clampToMax,
} from "../rules/derived-values";
import {
  CHARACTERISTIC_MAX,
  CHARACTERISTIC_MIN,
  SKILL_LEVEL_MAX,
  SKILL_LEVEL_MIN,
} from "../rules/limits";
import type { SkillRollParams } from "../rules/skill-roll";
import { type ModifierSet, NO_MODIFIER } from "../rules/types";
import { typedEntries } from "../utils/object";
import type { ArmorDataModel, SkillDataModel } from "./item-models";
import { EmokloreSystemDataModel } from "./system-model";

const { NumberField, SchemaField, StringField, TypedObjectField } = foundry.data.fields;

/**
 * どの技能を振るか。
 *
 * 技能と基本技能は別の表にあり、キーの集合も違う。`(skill: string, { base: boolean })`
 * のような組で渡すと「base: true に通常技能のキー」という有り得ない組み合わせが
 * 型で作れてしまい、受け取った側は as で名乗り直すしかなくなる。判別可能unionにして、
 * 種別とキーが必ず対応するようにする。
 */
export type SkillRef =
  | { kind: "skill"; key: SkillKey }
  | { kind: "base"; key: BaseSkillKey }
  /** カスタム技能。表ではなく所持アイテムに居るので、キーではなくアイテムのidで指す */
  | { kind: "custom"; id: string };

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

/**
 * カスタム技能1件ぶんのミラー。
 *
 * `data/` から `documents/` は参照しない決まりなので、元になる skill アイテムは
 * 構造的に受ける（`SkillItemLike`）。
 */
export type CustomSkillEntry = {
  /** 判定に使うレベル。ベース技能は常に1 */
  level: number;
  characteristic: CharacteristicKey;
  mod: ModifierSet;
  /** 表示名。アイテムの名前をそのまま使う */
  label: string;
  isBase: boolean;
  isExtra: boolean;
  /** どのグループにも属さないものは "" */
  group: SkillGroupKey | "";
  /** 選べる能力値。2件以上ならシートに選択欄が出る */
  characteristicOptions: CharacteristicKey[];
  /** prepareDerivedData が入れる */
  target: number;
};

/** ミラーの元になる skill アイテム。documents/ を参照しないため構造で受ける */
type SkillItemLike = {
  id: string | null;
  name: string;
  system: SkillDataModel;
};

/** 集計の元になる armor アイテム。documents/ を参照しないため構造で受ける */
type ArmorItemLike = {
  system: ArmorDataModel;
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
export const modifierField = () =>
  new SchemaField(
    {
      bonus: new NumberField({ required: true, integer: true, initial: 0 }),
      success: new NumberField({ required: true, integer: true, initial: 0 }),
      target: new NumberField({ required: true, integer: true, initial: 0 }),
    },
    // 保存しない。この組はシートから編集できず、ActiveEffectの着地点としてだけ存在する。
    // スキーマには残るので効果は DataField 経由で乗り、効果値のRoll評価も整数の検証も効く。
    // 保存対象から外れることで、アクター1体につき 64組×3値 が保存データから消える
    { persisted: false },
  );

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

// HP・MPの最大値は毎回 prepareDerivedData が能力値から出し直すので保存しない。
// 保存しても次の準備で捨てられる値で、スキーマに居座ると「書けるのに残らない」
// フィールドになる。効果を当てたいときは phase: "final" で上書きする
const derivedMaxField = (initial: number) =>
  new NumberField({ required: true, integer: true, initial, persisted: false });

/**
 * HP/MP（＋共鳴者だけ共鳴値）のリソース。
 *
 * HP/MPの最大値は能力値からの派生なので保存しない。共鳴値は共鳴者（character）だけが持ち、
 * 上限は手で決めるので保存する。人間NPC（npc）は resonance を持たないので `resonance:false`。
 */
export const defineResourcesSchema = ({ resonance }: { resonance: boolean }) =>
  new SchemaField({
    hp: new SchemaField({
      value: new NumberField({ required: true, integer: true, initial: 11 }),
      max: derivedMaxField(11),
    }),
    mp: new SchemaField({
      value: new NumberField({ required: true, integer: true, initial: 2 }),
      max: derivedMaxField(2),
    }),
    ...(resonance
      ? {
          resonance: new SchemaField({
            value: new NumberField({ required: true, integer: true, initial: 1 }),
            // 共鳴値の上限だけは計算せず手で決めるので、こちらは保存する
            max: new NumberField({ required: true, integer: true, initial: 9 }),
            // 共鳴判定への修正の着地点（残響「ハーモニー」）。技能判定の mod と同じ形
            mod: modifierField(),
          }),
        }
      : {}),
  });

/**
 * 能力値・技能で判定を振るアクターの共通スキーマと派生。
 *
 * 共鳴者（character）と人間NPC（npc）が継承する。ルールブック上「人間NPCに専用ルールは無く、
 * 判定が要るなら共鳴者と同じ作りになる」ので、判定に効く値（能力値・技能・基本技能・
 * カスタム技能・技能グループ・全体修正）と、その派生（目標値・HP/MP最大・初速）をここに集める。
 *
 * 感情・経歴・共鳴値は共鳴者だけの持ち物なので character 側に置く。怪異（kai）はこの形を
 * 継承せず、直接判定の攻撃を持つ別形状にする。
 */
export class CharacterLikeDataModel extends EmokloreSystemDataModel {
  // target は prepareDerivedData で必ず設定される派生値（initiative と同じ扱い）。
  // それ以外は defineSchema のスキーマと一致させること
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

  /**
   * カスタム技能のミラー。キーは skill アイテムのid。
   *
   * `level` / `characteristic` / `mod` はスキーマにあり効果を当てられる。残りは
   * アイテム側から写しただけの表示・計算用で、スキーマには無い（効果の対象にもならない）。
   */
  declare customSkills: Record<string, CustomSkillEntry>;

  /** 判定すべてに効く修正 */
  declare mod: ModifierSet;

  /** 行動値。prepareDerivedData が毎回入れ直す */
  declare initiative: number;
  declare armor: number;

  static override defineSchema() {
    return {
      // HP/MP。共鳴値は共鳴者だけが持つので character 側で resources を差し替える
      resources: defineResourcesSchema({ resonance: false }),

      /**
       * 判定すべてに効く修正。
       *
       * ルールブックの「全ての技能は判定値-2される」のように、能力値でも技能でも
       * 技能グループでも切り分けられない修正がハウリング表に多くあり、これまで
       * 表現する場所が無かった。他の mod と同じ3値を持つ
       */
      mod: modifierField(),

      /**
       * 行動値。身体＋〈スピード〉のレベルで、prepareDerivedData が毎回入れ直す。
       *
       * 保存しないがスキーマには置く。`system.json` の `"initiative": "@initiative"` が
       * 参照するうえ、ここに無いとActiveEffectを当てたとき本体が型を推測する経路に落ちて、
       * 効果値のRoll評価も整数の検証も効かなくなる
       */
      initiative: new NumberField({ required: true, integer: true, initial: 0, persisted: false }),

      /**
       * 装備中防具の防御力合計。ダメージ適用が軽減として引く値で、prepareDerivedData が
       * 毎回入れ直す。保存しないがスキーマには置く（initiative と同じ理由。
       * ActiveEffect（final）で防御力を修正する余地もこれで残る）
       */
      armor: new NumberField({
        required: true,
        integer: true,
        min: 0,
        initial: 0,
        persisted: false,
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

      /**
       * カスタム技能の判定に使う値。**正はアクターではなく所持している skill アイテム**で、
       * ここは `prepareBaseData` が毎回作り直すミラー。
       *
       * わざわざアクター側に写しているのは、本体が Item に `applyActiveEffects` を持たないため
       * （`client/documents/actor.mjs` にしか無い）。効果は `actor.system.*` にしか着地できないので、
       * 「〈忍術〉の判定に+1」を組込技能と同じように書けるようにするには受け皿がここに要る。
       * 既存の `mod` が `persisted: false` の着地点でしかないのと同じ考え方の延長。
       *
       * `TypedObjectField` なのでキーを実行時に増やせる。本体の `getFieldForProperty` は
       * `_source` を渡して解決するため、保存しないこの表でも効果は DataField 経由で乗る。
       */
      customSkills: new TypedObjectField(
        new SchemaField({
          // ベース技能は常に1が入る（calculateCustomSkillLevel が決める）
          level: new NumberField({
            min: SKILL_LEVEL_MIN,
            max: SKILL_LEVEL_MAX,
            initial: 0,
            integer: true,
            required: true,
            nullable: false,
          }),
          characteristic: new StringField({ required: true }),
          mod: modifierField(),
        }),
        { persisted: false },
      ),

      skillGroups: new SchemaField(
        Object.fromEntries(
          typedEntries(CONFIG.EMOKLORE.skillGroups).map(([group]) => [
            group,
            new SchemaField({
              // label は持たない。game.i18n.localize した結果を initial に焼き込むと、
              // アクター作成後に言語を切り替えても古いラベルが残る
              mod: modifierField(),
            }),
          ]),
        ),
      ),
    };
  }

  /**
   * カスタム技能のミラーを所持アイテムから作り直す。
   *
   * ここで作るのは、この直後の `prepareEmbeddedDocuments` が
   * `applyActiveEffects("initial")` を走らせるため。効果が着地する時点で受け皿が
   * 出来ていないと「〈忍術〉に+1」が行き場を失う。
   *
   * 空の表から作り直す。実測では `prepareData` のたびにスキーマの `initialize` が
   * 新しいオブジェクトを渡してくるので前回の内容は残らないが、それに寄りかからず
   * 「所持しているアイテムがすべて」であることをここで明示しておく。
   */
  override prepareBaseData() {
    super.prepareBaseData();

    this.customSkills = {};

    for (const item of this.#skillItems()) {
      // 保存済みの埋め込みアイテムなので id は必ずある
      if (!item.id) continue;
      const { category, characteristic, characteristicOptions, group, level } = item.system;
      const isBase = category === "base";

      this.customSkills[item.id] = {
        level: calculateCustomSkillLevel(isBase, level),
        characteristic,
        mod: { bonus: 0, success: 0, target: 0 },
        label: item.name,
        isBase,
        isExtra: category === "extra",
        group,
        characteristicOptions: [...characteristicOptions],
        // prepareDerivedData が入れ直す
        target: 0,
      };
    }
  }

  /**
   * 所持しているカスタム技能のアイテム。
   *
   * 種別で絞るのは本体の `itemTypes` に任せる。埋め込みコレクション側でメモ化されており
   * （`common/abstract/embedded-collection.mjs` の `documentsByType`）、自前で毎回
   * 全アイテムを回すより、何より「どれが技能か」を決める場所が増えない。
   *
   * `TypeDataModel#parent` は Document 止まりで埋め込みコレクションが型に出ないため、
   * ここで1回だけ絞る（`data/messages/weapon-card.ts` の `this.parent as CardMessage` と同じ扱い）。
   */
  #skillItems(): SkillItemLike[] {
    const actor = this.parent as { itemTypes?: { skill?: SkillItemLike[] } };

    return actor.itemTypes?.skill ?? [];
  }

  /** 種別で絞るのは #skillItems と同じく本体の itemTypes に任せる */
  #armorItems(): ArmorItemLike[] {
    const actor = this.parent as { itemTypes?: { armor?: ArmorItemLike[] } };

    return actor.itemTypes?.armor ?? [];
  }

  override prepareDerivedData() {
    super.prepareDerivedData();

    for (const skill of Object.values(this.customSkills)) {
      skill.target = calculateCustomSkillTarget(
        skill.isBase,
        skill.level,
        this.characteristics[skill.characteristic].value,
      );
    }

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

    const { hp, mp } = this.resources;
    hp.max = calculateMaxHp(this.characteristics.physical.value);
    hp.value = clampToMax(hp.value, hp.max);
    mp.max = calculateMaxMp(
      this.characteristics.mentality.value,
      this.characteristics.intelligence.value,
    );
    mp.value = clampToMax(mp.value, mp.max);

    this.initiative = calculateInitiative(
      this.characteristics.physical.value,
      this.skills.speed.level,
    );

    this.armor = calculateArmorTotal(this.#armorItems().map((item) => item.system));
  }

  /**
   * 技能判定に必要な値をアクターから集める。
   *
   * 判定式そのものは rules/skill-roll.ts が持つ。ここはあくまで
   * 「どの値を渡すか」を決めるだけで、表示用の整形は呼び出し側に任せる。
   */
  getSkillRollContext(ref: SkillRef): SkillRollContext {
    if (ref.kind === "custom") {
      const entry = this.customSkills[ref.id];
      // 呼び出し側がミラーに居ることを確かめてから来る決まり。破れたら黙って
      // 変な判定を振るより、どのidで来たかを言って止まるほうがよい
      if (!entry) throw new Error(`emoklore | カスタム技能が見つかりません: ${ref.id}`);

      return {
        params: this.#toRollParams(entry, entry.group),
        label: entry.label,
        isBase: entry.isBase,
        isExtra: entry.isExtra,
      };
    }

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
   * 技能・基本技能・カスタム技能に共通する、判定に効く値の取り出し。
   *
   * 技能グループは保存データではなく CONFIG.EMOKLORE 側の定義なので引数で受ける。
   * カスタム技能はどのグループにも属さないことがあるので `""` を許し、
   * そのときはグループ修正の代わりに効かない組を渡す。
   */
  #toRollParams(
    entry: {
      level: number;
      target: number;
      characteristic: CharacteristicKey;
      mod: ModifierSet;
    },
    group: SkillGroupKey | "",
  ): SkillRollParams {
    return {
      level: entry.level,
      baseTarget: entry.target,
      skillMod: entry.mod,
      characteristicMod: this.characteristics[entry.characteristic].mod,
      skillGroupMod: group ? this.skillGroups[group].mod : NO_MODIFIER,
      globalMod: this.mod,
      // その場の修正は保存データではなく判定のたびの入力なので、ここでは効かない組を置く。
      // 差し込むのは判定を組み立てる documents/ 側
      situationalMod: NO_MODIFIER,
    };
  }
}
