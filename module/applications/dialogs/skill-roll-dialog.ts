import { systemPath } from "../../constants";
import { requiredSuccesses, type SuccessRequirement } from "../../rules/success";
import type { ModifierSet } from "../../rules/types";

export type SkillRollInput = {
  /** その場かぎりの修正。`resolveSkillRoll` の5系統目に入る */
  situational: ModifierSet;
  /** 要求された成功数。指定なしは0 */
  requiredSuccess: number;
};

const TEMPLATE = systemPath("templates/apps/skill-roll.hbs");

/** 選べる成功度。ルールブックの難易度の目安の並びに合わせる */
const REQUIREMENTS: readonly SuccessRequirement[] = ["single", "double", "triple", "miracle"];

/**
 * 判定のオプションを尋ねる。ダイスボーナス・成功数修正・必要成功数の3つ。
 *
 * キャンセルされた場合は null を返す。`preset` を渡すと初期値になる（DLからの判定要求が
 * 指定したボーナスと成功数を差し込む導線）。
 *
 * 判定値修正はここでは尋ねない。ルール上の出どころが状態異常や極限共鳴の効果なので、
 * ActiveEffect の着地点（`mod.target`）で受けるほうが素直なため。器は共通なので、
 * 尋ねる必要が出たら入力を1つ足すだけで通る。
 */
export async function promptSkillRoll({
  bonus = 0,
  success = 0,
  requirement = "",
}: {
  bonus?: number;
  success?: number;
  requirement?: SuccessRequirement | "";
} = {}): Promise<SkillRollInput | null> {
  const content = await foundry.applications.handlebars.renderTemplate(TEMPLATE, {
    bonus,
    success,
    requirements: REQUIREMENTS.map((value) => ({
      value,
      label: game.i18n.localize("EMOKLORE.RollOptions.AtLeast", {
        result: game.i18n.localize(`EMOKLORE.result.${value}`),
      }),
      selected: value === requirement,
    })),
  });

  // prompt は static メソッドで中身が this.wait(...) なので、変数に取り出して呼ぶと
  // thisが外れて壊れる。必ずメソッドとして呼ぶこと。
  // キャストが要るのは、本体JSDocの引数型に config.ok が含まれていないため
  const result = await foundry.applications.api.DialogV2.prompt({
    // DialogV2 の既定の classes は ["dialog"] だけで emoklore も standard-form も
    // 付かない。本体のフォーム体系に乗せるには明示的に渡す必要がある
    classes: ["emoklore", "standard-form"],
    window: { title: game.i18n.localize("EMOKLORE.RollOptions.Title") },
    content,
    ok: {
      label: game.i18n.localize("EMOKLORE.Resonance.RollButton"),
      callback: (_event: Event, button: HTMLElement) => readInput(button),
    },
    // 閉じられた場合はnullで返る。rejectCloseで例外にすると本物のエラーを握り潰しやすい
    rejectClose: false,
  } as Parameters<typeof foundry.applications.api.DialogV2.prompt>[0]);

  return (result as SkillRollInput | null) ?? null;
}

/**
 * フォームの入力を読む。
 *
 * **ここでは弾かない。** 本体の `_onSubmit` は `(await callback()) ?? button.action` と
 * 書かれており、callback が null を返すと結果が文字列 `"ok"` にすり替わる。
 * 空欄の数値入力は NaN になるので0に倒し、必ずオブジェクトを返す。
 */
function readInput(button: HTMLElement): SkillRollInput {
  const form = (button as HTMLButtonElement).form as HTMLFormElement;
  const read = (name: string) => {
    const value = (form.elements.namedItem(name) as HTMLInputElement).valueAsNumber;
    return Number.isNaN(value) ? 0 : value;
  };

  const requirement = (form.elements.namedItem("requirement") as HTMLSelectElement).value;

  return {
    // 判定値修正はこのダイアログでは尋ねないので0のまま
    situational: { bonus: read("bonus"), success: read("success"), target: 0 },
    // 選択肢の value は SuccessRequirement か空文字。空なら要求なし（0）
    requiredSuccess: isRequirement(requirement) ? requiredSuccesses(requirement) : 0,
  };
}

/** selectの値はDOM由来なので、成功度として名乗る前に確かめる */
const isRequirement = (value: string): value is SuccessRequirement =>
  (REQUIREMENTS as readonly string[]).includes(value);
