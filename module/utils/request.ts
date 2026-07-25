/**
 * DLからの判定要求カードの見せ方。
 *
 * `utils/weapon.ts` と同じ立ち位置で、保存データと `config/` の定義を合流させて
 * テンプレートに渡す形まで整える。判定を振るのは `applications/` の担当。
 */

import { isBaseSkillKey } from "../config/base-skills";
import { isSkillKey } from "../config/skills";
import { systemPath } from "../constants";
import type { RequestedSkill } from "../data/messages/skill-request";
import { requiredSuccesses, resolveResultName } from "../rules/success";
import { skillMarker } from "./skill";

const TEMPLATE = systemPath("templates/chat/skill-request.hbs");

/** カードに焼き込む要求の内容。ChatMessage のサブタイプのスキーマと同じ形 */
export type SkillRequestState = {
  skills: RequestedSkill[];
  requiredSuccess: number;
  bonus: number;
  successMod: number;
  note: string;
};

/** カードに並べる技能1つぶん。`kind` と `key` はボタンの dataset に載せる */
export type RequestedSkillRow = RequestedSkill & { label: string };

/**
 * 要求された技能の表示名を引く。「＊知覚」「★霊感」のように印を頭に付ける。
 *
 * 保存データのキーは型を裏切りうるので、CONFIG を引く前に型述語を通す。引けない
 * キーはキーそのものを出す。黙って行を落とすと、DLの指定が消えたのか元から
 * 無かったのかが卓から見て分からなくなる。
 */
export const describeRequestedSkill = ({ kind, key }: RequestedSkill): RequestedSkillRow => {
  if (kind === "base" && isBaseSkillKey(key)) {
    return {
      kind,
      key,
      label: `${skillMarker(true, false)}${CONFIG.EMOKLORE.baseSkills[key].label}`,
    };
  }

  if (kind === "skill" && isSkillKey(key)) {
    const { label, isExtra } = CONFIG.EMOKLORE.skills[key];
    return { kind, key, label: `${skillMarker(false, isExtra ?? false)}${label}` };
  }

  return { kind, key, label: key };
};

/** 要求された成功度の表示。「ダブル成功以上」。指定なしは空文字 */
export const formatRequirement = (requiredSuccess: number): string => {
  if (requiredSuccess <= 0) return "";

  return game.i18n.localize("EMOKLORE.RollOptions.AtLeast", {
    result: game.i18n.localize(`EMOKLORE.result.${resolveResultName(requiredSuccess)}`),
  });
};

/** 判定要求カードのHTMLを組み立てる */
export const renderSkillRequestCard = (state: SkillRequestState): Promise<string> =>
  foundry.applications.handlebars.renderTemplate(TEMPLATE, {
    skills: state.skills.map(describeRequestedSkill),
    requirement: formatRequirement(state.requiredSuccess),
    bonus: state.bonus,
    successMod: state.successMod,
    note: state.note,
  });

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

/** 要求を作るときに、指定できる成功度と要る成功数の対 */
export const requirementChoices = (): Array<{ value: number; label: string }> =>
  (["single", "double", "triple", "miracle"] as const).map((requirement) => ({
    value: requiredSuccesses(requirement),
    label: game.i18n.localize("EMOKLORE.RollOptions.AtLeast", {
      result: game.i18n.localize(`EMOKLORE.result.${requirement}`),
    }),
  }));
