/**
 * 技能の見せ方に関する小物。エモクロア固有だがルール計算ではないものを置く。
 *
 * `utils/weapon.ts` と同じ立ち位置で、`config/` の定義を翻訳・整形するところまでを持つ。
 */

import { type BaseSkillKey, baseSkills, isBaseSkillKey } from "../config/base-skills";
import type { CharacteristicKey } from "../config/characteristics";
import { type SkillCategory, skillCategories } from "../config/skill-categories";
import type { SkillGroupKey } from "../config/skill-groups";
import { isSkillKey, type SkillKey, skills } from "../config/skills";
import {
  type ResultName,
  requiredSuccesses,
  resolveResultName,
  SUCCESS_REQUIREMENTS,
} from "../rules/success";
import { typedEntries } from "./object";

/**
 * 技能名の頭に付ける印。基本技能は `＊`、エクストラ技能は `★`。
 *
 * 直に呼ばず `describeSkillLabel` を通すこと。印を付けるかどうかの判断まで含めて
 * 1箇所にまとめてある。
 */
const skillMarker = (isBase: boolean, isExtra: boolean): string =>
  isBase ? "＊" : isExtra ? "★" : "";

/** どの技能を見せたいか。組込・基本は表から引き、カスタムは持っている値で名乗る */
export type SkillDescriptor =
  | { kind: "skill"; key: SkillKey }
  | { kind: "base"; key: BaseSkillKey }
  | { kind: "custom"; label: string; isBase: boolean; isExtra: boolean };

/** 技能の名前まわり */
export type SkillLabel = {
  /** 翻訳済みの表示名。印は含まない */
  label: string;
  /** 区分の印。基本技能は `＊`、エクストラ技能は `★`、通常技能は空 */
  marker: string;
  /** 印つきの表示名。1本の文字列で出すところ（チャット・選択肢）はこちらを使う */
  markedLabel: string;
};

/**
 * 技能の名前の見せ方を決める。**技能名の見た目を決めるのはここ1箇所。**
 *
 * シート・チャットの見出し・判定要求カード・効果の適用先・各種の選択肢が、すべて
 * これを通る。印の付け方を変えるならここだけを直せばよい。
 *
 * `CONFIG.EMOKLORE` の label は i18nInit の performPreLocalization で翻訳済みなので、
 * ここでは参照するだけでよい。
 */
export const describeSkillLabel = (ref: SkillDescriptor): SkillLabel => {
  const { label, marker } = resolveLabelParts(ref);

  return { label, marker, markedLabel: `${marker}${label}` };
};

const resolveLabelParts = (ref: SkillDescriptor): { label: string; marker: string } => {
  if (ref.kind === "custom") {
    return { label: ref.label, marker: skillMarker(ref.isBase, ref.isExtra) };
  }
  if (ref.kind === "base") {
    return { label: CONFIG.EMOKLORE.baseSkills[ref.key].label, marker: skillMarker(true, false) };
  }

  const { label, isExtra } = CONFIG.EMOKLORE.skills[ref.key];
  return { label, marker: skillMarker(false, isExtra ?? false) };
};

/** 技能1行の見せ方。名前まわりに、判定に使う能力値の見せ方を足したもの */
export type SkillDisplay = SkillLabel & {
  characteristic: CharacteristicKey;
  /** 能力値の翻訳済み表示名 */
  characteristicLabel: string;
  /** 能力値のFont Awesomeアイコンクラス */
  characteristicIcon: string;
};

/**
 * 技能1行の見せ方を組み立てる。
 *
 * 能力値は表ではなくアクターの保存値が正（選べる技能があり、効果でも動く）なので、
 * 引く側から渡してもらう。
 */
export const describeSkill = (
  ref: SkillDescriptor,
  characteristic: CharacteristicKey,
): SkillDisplay => {
  const { label: characteristicLabel, fa } = CONFIG.EMOKLORE.characteristics[characteristic];

  return {
    ...describeSkillLabel(ref),
    characteristic,
    characteristicLabel,
    characteristicIcon: fa,
  };
};

/**
 * カスタム技能の区分の表示名。
 *
 * `skillCategories` の label はi18nキーのまま（スキーマの choices と共有しているので
 * preLocalize の対象にしていない）。翻訳は引く側で行う。
 */
export const localizeSkillCategory = (category: SkillCategory): string =>
  _loc(skillCategories[category].label);

/** 能力値の表示名。CONFIG.EMOKLORE の label は i18nInit で翻訳済み */
const localizeCharacteristic = (key: CharacteristicKey): string =>
  CONFIG.EMOKLORE.characteristics[key].label;

/**
 * 参照能力値の並び。複数あるものは「身体／器用」のように連ねる。
 *
 * ルールブックは【身体 or 器用】と書くが、シートの列は狭いので区切りだけにしている。
 * 組込技能の `docs/data-model.md` の表も同じ「／」で並べている。
 */
export const formatCharacteristicOptions = (options: Iterable<CharacteristicKey>): string =>
  [...options].map(localizeCharacteristic).join("／");

/** 技能グループの表示名。所属しないカスタム技能は「なし」 */
export const formatSkillGroup = (group: SkillGroupKey | ""): string =>
  group ? CONFIG.EMOKLORE.skillGroups[group].label : _loc("EMOKLORE.Common.none");

/**
 * 表に居る技能への参照。保存データや選択の値に書ける形。
 *
 * `data/character-like.ts` の `SkillRef` にはカスタム技能（表ではなくアイテムのidで指す）が
 * 入るが、カスタム技能はアクター固有なので、配り物やDLの要求からは指せない。ここはその
 * 指せるぶんだけを持つ。`data/messages/skill-request.ts` の `RequestedSkill` も同じ形。
 */
export type StoredSkillRef = {
  kind: "skill" | "base";
  key: string;
};

/** 選択肢の value は「経路:キー」。selectの値は1本の文字列にしかならないので繋ぐ */
export const SKILL_REF_SEPARATOR = ":";

/**
 * 技能をひとつ選ばせるときの選択肢。通常技能と基本技能の2グループに分ける。
 *
 * 印（★ / ＊）を付けてシートの表記と揃える。47感情のような一望の必要は無いので、
 * 専用のピッカーは作らず optgroup 付きの素の select で足りる。
 */
export const buildSkillRefGroups = (): Array<{
  label: string;
  skills: Array<{ value: string; label: string }>;
}> => [
  {
    label: _loc("EMOKLORE.SkillRequest.NormalSkills"),
    skills: typedEntries(CONFIG.EMOKLORE.skills).map(([key]) => ({
      value: toSkillRefValue({ kind: "skill", key }),
      label: describeSkillLabel({ kind: "skill", key }).markedLabel,
    })),
  },
  {
    label: _loc("EMOKLORE.SkillRequest.BaseSkills"),
    skills: typedEntries(CONFIG.EMOKLORE.baseSkills).map(([key]) => ({
      value: toSkillRefValue({ kind: "base", key }),
      label: describeSkillLabel({ kind: "base", key }).markedLabel,
    })),
  },
];

/** 「経路:キー」を分解する。value は自分で組んだものなので、経路は base 以外を skill に倒す */
export const parseSkillRefValue = (value: string): StoredSkillRef => {
  const [kind, key = ""] = value.split(SKILL_REF_SEPARATOR);
  return { kind: kind === "base" ? "base" : "skill", key };
};

/** 参照を「経路:キー」に戻す。選択の初期値を組むときに使う */
export const toSkillRefValue = ({ kind, key }: StoredSkillRef): string =>
  `${kind}${SKILL_REF_SEPARATOR}${key}`;

/**
 * スキーマの choices に渡す表。キーは「経路:キー」、値は翻訳済み文字列ではなくi18nキー。
 *
 * 通常技能と基本技能を1本に混ぜてある。`choices` は組にしか使えず optgroup を作れないが、
 * 48件の表示名に重複が無いので（`npm run check:schema-doc` が見ている表そのもの）、
 * 印が無くても取り違えは起きない。印を付けた並びが要るところは `buildSkillRefGroups`。
 */
export const skillRefChoices: Record<string, string> = Object.fromEntries([
  ...Object.entries(skills).map(([key, { label }]) => [`skill${SKILL_REF_SEPARATOR}${key}`, label]),
  ...Object.entries(baseSkills).map(([key, { label }]) => [
    `base${SKILL_REF_SEPARATOR}${key}`,
    label,
  ]),
]);

/** 判定のショートカットに要る形。`rollType` はシートの `data-roll-type` の値と対応する */
export type SkillRollShortcut = {
  rollType: "skill" | "base-skill";
  key: string;
  label: string;
};

/**
 * 「経路:キー」の並びを、判定のショートカットに要る形へ写す。
 *
 * `formatSkillRefs` が1本の文字列にするのに対し、こちらは技能ごとにボタンを並べたい
 * ところで使う。表に無いものは落とす（理由は `formatSkillRefs` と同じ）。
 */
export const toSkillRollShortcuts = (values: Iterable<string>): SkillRollShortcut[] =>
  [...values].flatMap((value): SkillRollShortcut[] => {
    const ref = toDescriptor(value);
    if (!ref) return [];

    return [
      {
        rollType: ref.kind === "base" ? "base-skill" : "skill",
        key: ref.key,
        label: describeSkillLabel(ref).markedLabel,
      },
    ];
  });

/**
 * 「経路:キー」の並びを表示名にする。「＊自我／心理」。
 *
 * 保存データの値は外から来るので、表に無いものは落とす（configのキーを改名しても、
 * 古いデータは尻切れの表示になるだけで済む）。区切りは `formatCharacteristicOptions` と同じ。
 */
export const formatSkillRefs = (values: Iterable<string>): string =>
  [...values]
    .flatMap((value) => {
      const ref = toDescriptor(value);
      return ref ? [describeSkillLabel(ref).markedLabel] : [];
    })
    .join("／");

/**
 * 保存された「経路:キー」を、表に居ることを確かめたうえで参照に変える。
 *
 * 保存データのキーは外から来るので、CONFIG を引く前に型述語を通す。表に無ければ null。
 */
const toDescriptor = (
  value: string,
): { kind: "skill"; key: SkillKey } | { kind: "base"; key: BaseSkillKey } | null => {
  const { kind, key } = parseSkillRefValue(value);

  if (kind === "base") return isBaseSkillKey(key) ? { kind, key } : null;
  return isSkillKey(key) ? { kind, key } : null;
};

/**
 * 通常技能に対応するベース技能のキー。
 *
 * 技能グループのキーは基本技能のキーと同じ綴りで、〈観察眼〉なら `perception`＝〈＊知覚〉に
 * なる（`docs/data-model.md`「グループは基本技能と同じ綴りのキーを使うが別のテーブル」）。
 * ルールブックが「〈観察眼〉または〈＊知覚〉で判定」と併記する形をそのまま作れる。
 *
 * 対応が無い技能（グループを持たないもの）は null。
 */
export const baseSkillOf = (key: string): string | null => {
  if (!isSkillKey(key)) return null;

  const { group } = CONFIG.EMOKLORE.skills[key];
  return group && isBaseSkillKey(group) ? group : null;
};

/**
 * 成功度を「ダブル成功以上」の形にする。
 *
 * 要求の表示は判定要求カード・要求ダイアログ・判定オプションの3箇所で要る。
 * `dice/emoklore-roll.ts` にも同じ組み立てがあるが、あちらは `dice/` から
 * `utils/` を読めない（`docs/code-design.md` の層とimportの方向）ので共有しない。
 */
export const formatSuccessRequirement = (result: ResultName): string =>
  _loc("EMOKLORE.RollOptions.AtLeast", {
    result: _loc(`EMOKLORE.Result.${result}`),
  });

/** 要求された成功数の表示。「ダブル成功以上」。指定なしは空文字 */
export const formatRequirement = (requiredSuccess: number): string =>
  requiredSuccess > 0 ? formatSuccessRequirement(resolveResultName(requiredSuccess)) : "";

/** 判定要求を作るときに、指定できる成功度と要る成功数の対 */
export const requirementChoices = (): Array<{ value: number; label: string }> =>
  SUCCESS_REQUIREMENTS.map((requirement) => ({
    value: requiredSuccesses(requirement),
    label: formatSuccessRequirement(requirement),
  }));
