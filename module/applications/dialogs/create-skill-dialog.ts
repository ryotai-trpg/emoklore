import { type CharacteristicKey, isCharacteristicKey } from "../../config/characteristics";
import {
  isSkillCategory,
  SKILL_CATEGORIES,
  type SkillCategory,
} from "../../config/skill-categories";
import { isSkillGroupKey, type SkillGroupKey } from "../../config/skill-groups";
import { systemPath } from "../../constants";
import { typedEntries } from "../../utils/object";
import { localizeSkillCategory } from "../../utils/skill";

const TEMPLATE = systemPath("templates/apps/create-skill.hbs");

/** 参照能力値の既定。1つも選ばれていない技能を作れないようにするための足場 */
const DEFAULT_CHARACTERISTIC = "physical" satisfies CharacteristicKey;

/** 作成ダイアログが返す、検証済みの入力 */
export type CreateSkillInput = {
  name: string;
  category: SkillCategory;
  characteristicOptions: CharacteristicKey[];
  group: SkillGroupKey | "";
};

/**
 * カスタム技能の作成ダイアログ。
 *
 * 名前と区分と参照能力値は作ったあとから技能シートでも直せるが、最初に決まっていないと
 * 行が描けない（能力値が無いと目標値が出ない）ので、ここで揃えてから作る。
 *
 * 状態を持たず入力を1回受け取るだけなので DialogV2.prompt に載せている
 * （使い分けは docs/ui-design.md）。
 */
export async function promptCreateSkill(): Promise<CreateSkillInput | null> {
  const content = await foundry.applications.handlebars.renderTemplate(TEMPLATE, {
    categories: buildCategoryOptions(),
    characteristics: buildCharacteristicOptions(),
    groups: buildGroupOptions(),
  });

  // DialogV2.prompt は中身が this.wait(...) なので、変数に取り出すと this が外れる
  const result = await foundry.applications.api.DialogV2.prompt({
    // 既定の classes は ["dialog"] だけ。emoklore も standard-form も付かない
    classes: ["emoklore", "standard-form"],
    window: { title: game.i18n.localize("EMOKLORE.Skill.Create") },
    content,
    ok: {
      label: game.i18n.localize("EMOKLORE.Skill.Create"),
      callback: (_event: Event, button: HTMLElement) => readInput(button),
    },
    // 閉じたときに例外にすると、本物のエラーを握り潰しやすい
    rejectClose: false,
  } as Parameters<typeof foundry.applications.api.DialogV2.prompt>[0]);

  return (result as CreateSkillInput | null) ?? null;
}

const buildCategoryOptions = () =>
  SKILL_CATEGORIES.map((value) => ({
    value,
    label: localizeSkillCategory(value),
    // 通常技能が一番多いので既定にする
    checked: value === "normal",
  }));

const buildCharacteristicOptions = () =>
  typedEntries(CONFIG.EMOKLORE.characteristics).map(([value, { label, fa }]) => ({
    value,
    label,
    icon: fa,
    // 1つも選ばれていない状態を作らせない。外して別のものを選ぶぶんには自由
    checked: value === DEFAULT_CHARACTERISTIC,
  }));

const buildGroupOptions = () =>
  typedEntries(CONFIG.EMOKLORE.skillGroups).map(([value, { label }]) => ({ value, label }));

/**
 * フォームの入力を読む。
 *
 * **ここでは弾かない。** 本体の `_onSubmit` は `(await callback()) ?? button.action` と
 * 書かれており（`client/applications/api/dialog.mjs`）、callback が null を返すと
 * 結果が文字列 `"ok"` にすり替わったうえでダイアログも閉じる。入力し直す機会も無いまま
 * 呼び出し側に嘘の値が渡ってしまう。
 *
 * HTMLの `required` も使えない。ApplicationV2 の action がボタンのクリックを横取りして
 * `_onSubmit` を直接呼ぶため、本体のフォーム検証がそもそも走らない。
 *
 * そこで不正な状態を作れなくしてある。技能名が空なら呼び出し側が既定の名前を付け、
 * 参照能力値は既定で1つチェック済みにしたうえで、それでも空なら先頭に倒す。
 * 共鳴判定のダイアログが強度を正規化しているのと同じ考え方。
 *
 * 区分とグループも選択式なので普通は通るが、境界なので型述語は通しておく。
 */
function readInput(button: HTMLElement): CreateSkillInput {
  const form = (button as HTMLButtonElement).form as HTMLFormElement;

  const name = (form.elements.namedItem("name") as HTMLInputElement).value.trim();

  const rawCategory = (form.elements.namedItem("category") as RadioNodeList).value;
  const category: SkillCategory = isSkillCategory(rawCategory) ? rawCategory : "normal";

  const checked = [
    ...form.querySelectorAll<HTMLInputElement>('input[name="characteristics"]:checked'),
  ]
    .map((input) => input.value)
    .filter(isCharacteristicKey);

  const rawGroup = (form.elements.namedItem("group") as HTMLSelectElement).value;
  const group: SkillGroupKey | "" = isSkillGroupKey(rawGroup) ? rawGroup : "";

  return {
    name,
    category,
    characteristicOptions: checked.length > 0 ? checked : [DEFAULT_CHARACTERISTIC],
    group,
  };
}
