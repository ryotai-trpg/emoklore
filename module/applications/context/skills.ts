/**
 * 技能タブのコンテキストの組み立て。
 *
 * 共鳴者と人間NPCは `CharacterLikeDataModel` を共有しており、技能タブの行データも
 * 同じ形になる。どちらのシートもここを通ることで、行の見せ方（印・分野・段入力）が
 * 2系統に分かれない。
 */

import type { CharacterLikeDataModel } from "../../data/character-like";
import type { EmokloreActor } from "../../documents/actor";
import { calculateTotalSkillPoints, SKILL_POINT_MAX } from "../../rules/character-points";
import { typedEntries } from "../../utils/object";
import { describeSkill, SHEET_CONTEXT } from "../../utils/skill";
import { buildSkillLevelSegments } from "../helpers";
import type { BaseSkillRow, CustomSkillRow, SkillRow, SkillsContext } from "../types";

/** 能力値と技能を持つアクター。character と npc のシートがこの形に絞って渡す */
export type CharacterLikeActor = EmokloreActor & { system: CharacterLikeDataModel };

/**
 * 技能の表示用データ。
 *
 * 名前と区分は CONFIG.EMOKLORE 側の定義なので `describeSkill` が合流させる。ここが足すのは
 * アクター側の値と、編集モードの入力に要るものだけ。
 */
const buildSkills = (actor: CharacterLikeActor): Record<string, SkillRow> =>
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
const buildBaseSkills = (actor: CharacterLikeActor): BaseSkillRow[] =>
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
const buildCustomSkills = (actor: CharacterLikeActor): CustomSkillRow[] =>
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

/** 技能タブ。閲覧と編集でカスタム技能の並べ先が変わる */
export const buildSkillsContext = (
  actor: CharacterLikeActor,
  { isPlay }: { isPlay: boolean },
): SkillsContext => {
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
