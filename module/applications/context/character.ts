/**
 * 共鳴者シートがテンプレートに渡すデータの組み立て。
 *
 * シート（`applications/character-sheet.ts`）が持つのはパートの配線と操作のハンドラで、
 * 「テンプレートが何を受け取るか」はここが決める。パートごとに1つの関数にしてあり、
 * 戻り値の型を `Pick<CharacterContext, ...>` で縛ってあるので、コンテキストに無いキーを
 * 積もうとすると型チェックで止まる。
 */

import type { CharacterDataModel } from "../../data/character";
import type { EmokloreActor } from "../../documents/actor";
import {
  CHARACTERISTIC_POINT_MAX,
  calculateCharPointSum,
  calculateTotalSkillPoints,
  SKILL_POINT_MAX,
} from "../../rules/character-points";
import { CHARACTERISTIC_MAX, CHARACTERISTIC_MIN } from "../../rules/limits";
import { getSetting } from "../../settings";
import { prepareHowlingRows } from "../../utils/howling";
import { typedEntries } from "../../utils/object";
import { enrichDocumentHTML } from "../../utils/sheet";
import { describeSkill, SHEET_CONTEXT } from "../../utils/skill";
import {
  BIOGRAPHY_PAIRED_COUNT,
  buildBiographyRows,
  buildSkillLevelSegments,
  buildValueSegments,
} from "../helpers";
import type {
  BaseSkillRow,
  CharacterContext,
  CharacteristicsMap,
  CustomSkillRow,
  LabeledField,
  SkillRow,
} from "../types";
import { buildEffectCategories, itemsOfType } from "./actor";

/** このシートは type: "character" にしか登録しないので、アクターは共鳴者に絞れる */
type CharacterActor = EmokloreActor & { system: CharacterDataModel };

/**
 * 能力値の表示用データ。
 *
 * アイコンは CONFIG.EMOKLORE 側の定義なので、テンプレートで二重の lookup を
 * 組まずに済むようここで引いておく。
 */
const buildCharacteristics = (actor: CharacterActor): CharacteristicsMap =>
  Object.fromEntries(
    typedEntries(CONFIG.EMOKLORE.characteristics).map(([chc, { fa }]) => {
      const value = actor.system.characteristics[chc].value;
      return [
        chc,
        {
          field: actor.system.schema.getField(["characteristics", chc]),
          value,
          icon: fa,
          name: `system.characteristics.${chc}.value`,
          segments: buildValueSegments(CHARACTERISTIC_MIN, CHARACTERISTIC_MAX, value),
        },
      ];
    }),
  );

/**
 * 技能の表示用データ。
 *
 * 名前と区分は CONFIG.EMOKLORE 側の定義なので `describeSkill` が合流させる。ここが足すのは
 * アクター側の値と、編集モードの入力に要るものだけ。
 */
const buildSkills = (actor: CharacterActor): Record<string, SkillRow> =>
  Object.fromEntries(
    typedEntries(CONFIG.EMOKLORE.skills).map(([key, { isExtra }]) => {
      const entry = actor.system.skills[key];
      return [
        key,
        {
          // 分野は名前の一部として名乗る。組み立ては describeSkill が持つ
          ...describeSkill(
            { kind: "skill", key, specialization: entry.specialization },
            entry.characteristic,
            SHEET_CONTEXT,
          ),
          field: actor.system.schema.getField(["skills", key]),
          isExtra: isExtra ?? false,
          level: entry.level,
          target: entry.target,
          specialization: entry.specialization,
          mod: entry.mod,
          name: `system.skills.${key}.level`,
          levelSegments: buildSkillLevelSegments(entry.level),
        },
      ];
    }),
  );

/** 基本技能の表示用データ。目標値と能力値はアクター側が正 */
const buildBaseSkills = (actor: CharacterActor): BaseSkillRow[] =>
  typedEntries(actor.system.baseSkills).map(([key, { characteristic, target }]) => ({
    ...describeSkill({ kind: "base", key }, characteristic, SHEET_CONTEXT),
    key,
    target,
  }));

/**
 * カスタム技能の表示用データ。
 *
 * 判定に効く値はアクター側のミラー（`system.customSkills`）から引く。ミラーは
 * `prepareBaseData` が作るので、効果を適用したあとのレベルと目標値がそのまま入っている。
 * 並び順も `actor.items` の順のままなので、アイテムを引き直さない。
 */
const buildCustomSkills = (actor: CharacterActor): CustomSkillRow[] =>
  Object.entries(actor.system.customSkills).map(([id, entry]) => {
    const options = entry.characteristicOptions.map((key) => ({
      value: key,
      label: CONFIG.EMOKLORE.characteristics[key].label,
      selected: key === entry.characteristic,
    }));

    return {
      ...describeSkill(
        { kind: "custom", label: entry.label, isBase: entry.isBase, isExtra: entry.isExtra },
        entry.characteristic,
        SHEET_CONTEXT,
      ),
      id,
      level: entry.level,
      target: entry.target,
      isBase: entry.isBase,
      isExtra: entry.isExtra,
      characteristicOptions: options,
      hasCharacteristicChoice: options.length > 1,
      name: `system.customSkills.${id}.level`,
      levelSegments: buildSkillLevelSegments(entry.level),
    };
  });

/**
 * 消費した技能ポイント。
 *
 * カスタム技能も同じ表で数える。ベース技能はレベルを持たないので呼び出し側が除いてある。
 * エクストラ技能はコストが倍なので、`calculateTotalSkillPoints` の約束どおり
 * 全体と ex の両方に入れて2回数えさせる。
 */
const sumSkillPoints = (
  skills: Record<string, SkillRow>,
  customSkills: CustomSkillRow[],
): number => {
  const all = [...Object.values(skills), ...customSkills];

  return calculateTotalSkillPoints(
    all,
    all.filter((skill) => skill.isExtra),
  );
};

/**
 * サイドバー。
 *
 * 能力値はサイドバーのカードにしか出ないので、ここでだけ用意する。パートは同じ
 * コンテキストを共有するため、別のパートが積んだものを拾うとパートの順序への
 * 暗黙の依存になる。
 */
export const buildSidebarContext = (
  actor: CharacterActor,
): Pick<
  CharacterContext,
  "characteristics" | "charPointSum" | "charPointMax" | "sidebarCollapsed"
> => {
  const characteristics = buildCharacteristics(actor);

  return {
    characteristics,
    charPointSum: calculateCharPointSum(characteristics),
    charPointMax: CHARACTERISTIC_POINT_MAX,
    sidebarCollapsed: getSetting("sidebarCollapsed"),
  };
};

/** 技能タブ。閲覧と編集でカスタム技能の並べ先が変わる */
export const buildSkillsContext = (
  actor: CharacterActor,
  { isPlay }: { isPlay: boolean },
): Pick<
  CharacterContext,
  "skills" | "baseSkills" | "customSkills" | "customBaseSkills" | "skillPointSum" | "skillPointMax"
> => {
  const skills = buildSkills(actor);
  const customSkills = buildCustomSkills(actor);
  const base = customSkills.filter((skill) => skill.isBase);
  const leveled = customSkills.filter((skill) => !skill.isBase);

  return {
    skills,
    baseSkills: buildBaseSkills(actor),
    // 閲覧モードのベース技能はチップ列に並ぶ。編集モードは編集・削除の口が要るので
    // 区分に関わらず技能リストへ出す（組込の基本技能は編集する項目が無いので出ない）
    customSkills: isPlay ? leveled : customSkills,
    customBaseSkills: isPlay ? base : [],
    // ベース技能はレベルを持たないので技能ポイントを消費しない
    skillPointSum: sumSkillPoints(skills, leveled),
    skillPointMax: SKILL_POINT_MAX,
  };
};

/** 経歴タブ。備考だけリッチテキストなので、描く直前に enrich する */
export const buildBiographyContext = async (
  actor: CharacterActor,
): Promise<Pick<CharacterContext, "biographyPairedRows" | "biographyRows">> => {
  const noteHTML = await enrichDocumentHTML(actor, actor.system.biography.note);

  // systemFields の型は DataField 止まりで fields に降りられないため、スキーマから引く。
  // fields の値も label を持つ形に補っておき、キャストを1回で済ませる
  const biography = actor.system.schema.getField([
    "biography",
  ]) as foundry.data.fields.SchemaField & { fields: Record<string, LabeledField> };

  const rows = buildBiographyRows(biography.fields, actor.system.biography, { note: noteHTML });

  return {
    // 先頭の数件は横並びの組にするので、テンプレート側で分けて回せるよう2つに割る
    biographyPairedRows: rows.slice(0, BIOGRAPHY_PAIRED_COUNT),
    biographyRows: rows.slice(BIOGRAPHY_PAIRED_COUNT),
  };
};

/**
 * 効果タブ。
 *
 * ハウリング反応はアイテムそのものを別区分に並べる。反応が持つ効果は一時的／永続的の
 * 区分から除いてあり、**同じ反応が2行に分かれて見えないようにする**。効果を持たない
 * 反応（RPだけのもの）も並ぶのは、それも受けている状態には違いないため。
 */
export const buildEffectsContext = (
  actor: CharacterActor,
): Pick<CharacterContext, "howlings" | "effects"> => ({
  howlings: prepareHowlingRows(
    itemsOfType(actor, "howling")
      .filter((item) => item.isHowling())
      // 埋め込みドキュメントなので id は必ずある（アイテムタブの行と同じ扱い）
      .map((item) => ({ id: item.id!, name: item.name, img: item.img, system: item.system })),
  ),
  effects: buildEffectCategories(actor, { excludeHowlingSources: true }),
});
