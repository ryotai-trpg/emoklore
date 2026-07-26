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
import type { EmokloreItem } from "../../documents/item";
import {
  CHARACTERISTIC_POINT_MAX,
  calculateCharPointSum,
  calculateTotalSkillPoints,
  SKILL_POINT_MAX,
} from "../../rules/character-points";
import { CHARACTERISTIC_MAX, CHARACTERISTIC_MIN } from "../../rules/limits";
import { getSetting } from "../../settings";
import { prepareActiveEffectCategories } from "../../utils/effects";
import { prepareHowlingRows } from "../../utils/howling";
import { typedEntries } from "../../utils/object";
import { enrichDocumentHTML } from "../../utils/sheet";
import { describeSkill, SHEET_CONTEXT } from "../../utils/skill";
import { formatDamagePreview, formatRangeLabel } from "../../utils/weapon";
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

/** このシートは type: "character" にしか登録しないので、アクターは共鳴者に絞れる */
type CharacterActor = EmokloreActor & { system: CharacterDataModel };

/** `sort` はスキーマ由来で本体JSDocの型に出ないため、並べ替えの場面だけ足す */
type SortableItem = EmokloreItem & { sort: number };

/**
 * 所持アイテムを種別で絞り、`sort` の順に並べる。
 *
 * 絞り込みは本体の `itemTypes` に任せる（埋め込みコレクション側でメモ化されている）。
 * 本体は `Record<string, Item[]>` で型付けており実装クラスまでは絞られないので、
 * ここで1回だけ絞る。呼び出し側はさらに型述語を通して `system` を確定させる。
 *
 * **並べ直しは必須。** 本体の `documentsByType` は保存順（＝作成順）で返し `sort` を見ない
 * （`common/abstract/embedded-collection.mjs`）ので、ここを通さないとドラッグの並び替えが
 * `sort` を書くだけで表示に出ない。
 */
const itemsOfType = (actor: CharacterActor, type: string): EmokloreItem[] =>
  ((actor.itemTypes[type] ?? []) as SortableItem[]).toSorted((a, b) => a.sort - b.sort);

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
 * アイテムタブ。
 *
 * 間合いとダメージ式は武器の派生値（参照技能から引いたもの）なので、ここでは表示用に
 * 整えるだけ。読むだけの一覧で、値の編集は武器シートが持つ。同じ `name` の入力を2箇所に
 * 描くとフォームの送信が壊れるため、ここに入力は置かない。
 */
export const buildItemsContext = (
  actor: CharacterActor,
): Pick<CharacterContext, "weapons" | "armors"> => ({
  // isWeapon / isArmor は型述語なので、filter を通すと system が絞られる。
  // itemTypes の中身は元からその種別だけなので、実行時のふるまいは変わらない
  weapons: itemsOfType(actor, "weapon")
    .filter((item) => item.isWeapon())
    .map((item) => ({
      // 保存済みの埋め込みドキュメントなので id は必ずある
      id: item.id!,
      name: item.name,
      img: item.img,
      rangeLabel: formatRangeLabel(item.system.rangeType, item.system.range),
      damagePreview: formatDamagePreview(item.system.damageDie, item.system.attackPower),
      equipped: item.system.equipped,
    })),
  armors: itemsOfType(actor, "armor")
    .filter((item) => item.isArmor())
    .map((item) => ({
      id: item.id!,
      name: item.name,
      img: item.img,
      defense: item.system.defense,
      coverage: item.system.coverage,
      equipped: item.system.equipped,
    })),
});

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
  effects: prepareActiveEffectCategories(
    [...actor.allApplicableEffects()].filter(
      (effect) => (effect.parent as { type?: string } | null)?.type !== "howling",
    ),
  ),
});
