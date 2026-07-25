import { systemPath } from "../../constants";
import type { RequestedSkill, SkillRequestState } from "../../data/messages/skill-request";
import {
  baseSkillOf,
  buildSkillRefGroups,
  parseSkillRefValue,
  requirementChoices,
  toSkillRefValue,
} from "../../utils/skill";

const TEMPLATE = systemPath("templates/apps/skill-request.hbs");

/**
 * DLが判定要求の内容を決める。技能（複数）・必要成功数・ダイスボーナス・成功数修正・補足。
 *
 * キャンセルされた場合は null を返す。
 *
 * 技能は素の複数選択にしてある。47感情のような一望の必要が無く、通常技能と基本技能の
 * 2グループに分ければ optgroup で足りるため。
 */
export async function promptSkillRequest(): Promise<SkillRequestState | null> {
  const content = await foundry.applications.handlebars.renderTemplate(TEMPLATE, {
    groups: buildSkillRefGroups(),
    requirements: requirementChoices(),
  });

  // prompt は static メソッドで中身が this.wait(...) なので、変数に取り出して呼ぶと
  // thisが外れて壊れる。必ずメソッドとして呼ぶこと。
  // キャストが要るのは、本体JSDocの引数型に config.ok が含まれていないため
  const result = await foundry.applications.api.DialogV2.prompt({
    // DialogV2 の既定の classes は ["dialog"] だけで emoklore も standard-form も
    // 付かない。本体のフォーム体系に乗せるには明示的に渡す必要がある
    classes: ["emoklore", "standard-form"],
    // title と label は本体が _loc を通すので、キーをそのまま渡す
    window: { title: "EMOKLORE.SkillRequest.Title" },
    content,
    ok: {
      label: "EMOKLORE.SkillRequest.Post",
      callback: (_event: Event, button: HTMLElement) => readInput(button),
    },
    // 閉じられた場合はnullで返る。rejectCloseで例外にすると本物のエラーを握り潰しやすい
    rejectClose: false,
  } as Parameters<typeof foundry.applications.api.DialogV2.prompt>[0]);

  return (result as SkillRequestState | null) ?? null;
}

/**
 * フォームの入力を読む。
 *
 * **ここでは弾かない。** 本体の `_onSubmit` は `(await callback()) ?? button.action` と
 * 書かれており、callback が null を返すと結果が文字列 `"ok"` にすり替わる。技能を1つも
 * 選ばなくても空の要求として通す（DLが補足だけを出したい場合もある）。
 */
function readInput(button: HTMLElement): SkillRequestState {
  const form = (button as HTMLButtonElement).form as HTMLFormElement;

  // `valueAsNumber` は input にしかない。必要成功数は select なので、値の文字列から読む。
  // select で undefined を掴むと `Number.isNaN(undefined)` が false のまま素通りし、
  // 「指定なし」が「カタストロフ以上」として保存される
  const number = (name: string) => {
    const value = Number((form.elements.namedItem(name) as HTMLInputElement).value);
    return Number.isFinite(value) ? value : 0;
  };

  const selected = [...(form.elements.namedItem("skills") as HTMLSelectElement).selectedOptions];
  const skills = selected.map((option) => parseSkillRefValue(option.value));
  const withBase = (form.elements.namedItem("withBase") as HTMLInputElement).checked;

  return {
    skills: withBase ? appendBaseSkills(skills) : skills,
    requiredSuccess: number("requiredSuccess"),
    bonus: number("bonus"),
    successMod: number("successMod"),
    note: (form.elements.namedItem("note") as HTMLInputElement).value.trim(),
  };
}

/**
 * 選ばれた通常技能に対応するベース技能を後ろへ足す。
 *
 * ルールブックの指定は「〈観察眼〉または〈＊知覚〉で判定」の形が基本で、専門の技能を
 * 持たないPCも振れるようにベース技能を併記する。DLが毎回2つ選ぶ手間を省くための既定。
 */
const appendBaseSkills = (skills: RequestedSkill[]): RequestedSkill[] => {
  const result = [...skills];
  const known = new Set(skills.map(toSkillRefValue));

  for (const { kind, key } of skills) {
    if (kind !== "skill") continue;

    const base = baseSkillOf(key);
    if (!base) continue;

    const value = toSkillRefValue({ kind: "base", key: base });
    if (known.has(value)) continue;

    known.add(value);
    result.push({ kind: "base", key: base });
  }

  return result;
};
