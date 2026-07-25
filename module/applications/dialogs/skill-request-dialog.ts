import { systemPath } from "../../constants";
import type { RequestedSkill } from "../../data/messages/skill-request";
import { typedEntries } from "../../utils/object";
import type { SkillRequestState } from "../../utils/request";
import { baseSkillOf, requirementChoices } from "../../utils/request";
import { skillMarker } from "../../utils/skill";

const TEMPLATE = systemPath("templates/apps/skill-request.hbs");

/** 選択肢の value は「経路:キー」。selectの値は1本の文字列にしかならないので繋ぐ */
const SEPARATOR = ":";

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
    groups: buildSkillGroups(),
    requirements: requirementChoices(),
  });

  // prompt は static メソッドで中身が this.wait(...) なので、変数に取り出して呼ぶと
  // thisが外れて壊れる。必ずメソッドとして呼ぶこと。
  // キャストが要るのは、本体JSDocの引数型に config.ok が含まれていないため
  const result = await foundry.applications.api.DialogV2.prompt({
    // DialogV2 の既定の classes は ["dialog"] だけで emoklore も standard-form も
    // 付かない。本体のフォーム体系に乗せるには明示的に渡す必要がある
    classes: ["emoklore", "standard-form"],
    window: { title: game.i18n.localize("EMOKLORE.SkillRequest.Title") },
    content,
    ok: {
      label: game.i18n.localize("EMOKLORE.SkillRequest.Post"),
      callback: (_event: Event, button: HTMLElement) => readInput(button),
    },
    // 閉じられた場合はnullで返る。rejectCloseで例外にすると本物のエラーを握り潰しやすい
    rejectClose: false,
  } as Parameters<typeof foundry.applications.api.DialogV2.prompt>[0]);

  return (result as SkillRequestState | null) ?? null;
}

/** 通常技能と基本技能の2グループ。印（★ / ＊）を付けて、シートの表記と揃える */
const buildSkillGroups = () => [
  {
    label: game.i18n.localize("EMOKLORE.SkillRequest.NormalSkills"),
    skills: typedEntries(CONFIG.EMOKLORE.skills).map(([key, { label, isExtra }]) => ({
      value: `skill${SEPARATOR}${key}`,
      label: `${skillMarker(false, isExtra ?? false)}${label}`,
    })),
  },
  {
    label: game.i18n.localize("EMOKLORE.SkillRequest.BaseSkills"),
    skills: typedEntries(CONFIG.EMOKLORE.baseSkills).map(([key, { label }]) => ({
      value: `base${SEPARATOR}${key}`,
      label: `${skillMarker(true, false)}${label}`,
    })),
  },
];

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
  const skills = selected.map(toRequestedSkill);
  const withBase = (form.elements.namedItem("withBase") as HTMLInputElement).checked;

  return {
    skills: withBase ? appendBaseSkills(skills) : skills,
    requiredSuccess: number("requiredSuccess"),
    bonus: number("bonus"),
    successMod: number("successMod"),
    note: (form.elements.namedItem("note") as HTMLInputElement).value.trim(),
  };
}

/** 「経路:キー」を分解する。value は自分で組んだものなので、経路は base 以外を skill に倒す */
const toRequestedSkill = (option: HTMLOptionElement): RequestedSkill => {
  const [kind, key = ""] = option.value.split(SEPARATOR);
  return { kind: kind === "base" ? "base" : "skill", key };
};

/**
 * 選ばれた通常技能に対応するベース技能を後ろへ足す。
 *
 * ルールブックの指定は「〈観察眼〉または〈＊知覚〉で判定」の形が基本で、専門の技能を
 * 持たないPCも振れるようにベース技能を併記する。DLが毎回2つ選ぶ手間を省くための既定。
 */
const appendBaseSkills = (skills: RequestedSkill[]): RequestedSkill[] => {
  const result = [...skills];
  const known = new Set(skills.map(({ kind, key }) => `${kind}${SEPARATOR}${key}`));

  for (const { kind, key } of skills) {
    if (kind !== "skill") continue;

    const base = baseSkillOf(key);
    if (!base || known.has(`base${SEPARATOR}${base}`)) continue;

    known.add(`base${SEPARATOR}${base}`);
    result.push({ kind: "base", key: base });
  }

  return result;
};
