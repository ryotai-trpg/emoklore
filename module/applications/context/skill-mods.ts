/**
 * 技能タブに出す「効果による修正」の表示データ。
 *
 * セルに出す実効値は判定と同じ道（`getSkillRollContext` + `resolveSkillRoll`）から出す —
 * シートとチャットの式が別々の計算でドリフトしないための決め。効果名つきの内訳は
 * `utils/effect-breakdown.ts` の突き合わせを通し、寄与の合計がセルの値と一致する
 * ときだけ金額を出す。
 */

import type { EmokloreActor } from "../../documents/actor";
import type { SkillRollParams } from "../../rules/skill-roll";
import type { RollSpec } from "../../rules/types";
import { type AttributedChange, attributeRowModifiers } from "../../utils/effect-breakdown";
import {
  type ModifierAspect,
  type ModifierTarget,
  parseModifierKey,
} from "../../utils/effect-keys";
import type { SkillRowMod } from "../types";

/**
 * 効果のchange 1件。v14の正位置は `effect.system.changes`（`effect.changes` は非推奨shim）。
 * `value` は AnyField なので文字列とは限らない。本体JSDocの型に出ないため、読む形だけ書く
 */
type EffectChange = { key: string; type: string; value: unknown };

/**
 * アクターのactiveな効果から、`mod.*` に着地するchangeを寄与として集める。1描画に1回。
 *
 * `active` で絞る。効果タブの区分（`prepareActiveEffectCategories`）は `disabled`
 * （利用者が切ったか）で分けるが、ここは「いま効いているか」なので基準が違う —
 * 期限切れの効果は区分では一時的のまま残り、ここでは落ちる。
 * 段階（phase）は問わない。initial / final のどちらもmodへは最終的に合算される。
 */
export const collectModifierChanges = (actor: EmokloreActor): AttributedChange[] => {
  const collected: AttributedChange[] = [];
  const rollData = actor.getRollData();

  for (const effect of actor.allApplicableEffects()) {
    // active / name / system.changes は本体JSDocの型に出ないので、実際に読む形だけ補う
    const source = effect as ActiveEffect & {
      active: boolean;
      name: string;
      system: { changes?: EffectChange[] };
    };
    if (!source.active) continue;

    for (const change of source.system.changes ?? []) {
      const parsed = parseModifierKey(change.key);
      if (!parsed) continue;
      collected.push({
        target: parsed.target,
        aspect: parsed.aspect,
        amount: resolveChangeAmount(change, rollData),
        effectName: source.name,
      });
    }
  }

  return collected;
};

/**
 * changeの値を、本体が適用するときと同じ規則で数値化する。
 *
 * 本体は `NumberField#_castChangeDelta` が文字列を
 * `Roll.replaceFormulaData → evaluateSync` で数値に落とす（`common/data/fields.mjs`）。
 * 同じ道を写して、add は正・subtract は負の寄与とする。他の type
 * （override / multiply / upgrade …）は線形の寄与に直せないので null（帰属不能）。
 * 評価できない式（ダイス項・解決できない `@` 参照）も null に倒す
 */
const resolveChangeAmount = (
  change: EffectChange,
  rollData: Record<string, unknown>,
): number | null => {
  if (change.type !== "add" && change.type !== "subtract") return null;
  const sign = change.type === "add" ? 1 : -1;

  try {
    const Roll = foundry.dice.Roll;
    const numeric =
      typeof change.value === "string"
        ? Roll.create(
            Roll.replaceFormulaData(change.value, rollData, { recursive: true }),
          ).evaluateSync().total
        : Number(change.value);
    return Number.isFinite(numeric) ? sign * numeric : null;
  } catch {
    return null;
  }
};

/** 差分を「+2」「-1」の形に。ツールチップの金額はすべて符号つきで出す */
const signed = (value: number): string => (value >= 0 ? `+${value}` : `${value}`);

/**
 * 技能1行ぶんの修正表示。実効値・強調の要否・ツールチップの内訳HTMLまで組む。
 *
 * ツールチップは本体の `data-tooltip-html` に載せる。`#tooltip` は body 直下で
 * `.emoklore` の外に描かれるため、独自クラスや変数に依存させず素の要素だけで組む。
 */
export const buildRowMod = (
  params: SkillRollParams,
  spec: RollSpec,
  scopes: ModifierTarget[],
  changes: AttributedChange[],
): SkillRowMod => {
  const totals: Record<ModifierAspect, number> = {
    bonus: spec.diceCount - params.level,
    target: spec.target - params.baseTarget,
    success: spec.successMod,
  };
  const modified = totals.bonus !== 0 || totals.target !== 0 || totals.success !== 0;

  const base = {
    modified,
    target: spec.target,
    baseTarget: params.baseTarget,
    bonusApplies: totals.bonus !== 0,
    diceCount: spec.diceCount,
    successMod: spec.successMod,
  };
  if (!modified) return { ...base, tooltipHTML: "" };

  const { entries, amountShown } = attributeRowModifiers(changes, scopes, totals);

  const summary: string[] = [];
  if (totals.target !== 0) {
    summary.push(
      `<p>${_loc("EMOKLORE.Effect.Breakdown.Target", { base: params.baseTarget, effective: spec.target })}</p>`,
    );
  }
  if (totals.bonus !== 0) {
    summary.push(
      `<p>${_loc("EMOKLORE.Effect.Breakdown.Dice", { base: params.level, effective: spec.diceCount })}</p>`,
    );
  }
  if (totals.success !== 0) {
    summary.push(
      `<p>${_loc("EMOKLORE.Effect.Breakdown.Success", { amount: signed(totals.success) })}</p>`,
    );
  }

  const items = entries.map((entry) => {
    // 効果名は利用者の自由入力なのでエスケープする（cleanHTMLは通るが素性を揃えておく）
    const name = foundry.utils.escapeHTML(entry.effectName);
    const aspect = _loc(`EMOKLORE.Effect.Aspect.${entry.aspect}`);
    return amountShown[entry.aspect] && entry.amount !== null
      ? `<li>${_loc("EMOKLORE.Effect.Breakdown.Line", { name, amount: signed(entry.amount), aspect })}</li>`
      : `<li>${_loc("EMOKLORE.Effect.Breakdown.LineNoAmount", { name, aspect })}</li>`;
  });

  return {
    ...base,
    tooltipHTML: summary.join("") + (items.length > 0 ? `<ul>${items.join("")}</ul>` : ""),
  };
};
