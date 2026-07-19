import type { RollOptions } from "@client/dice/_types.mjs";
import { systemPath } from "../constants";
import { countSuccesses, type ResultName, resolveResultName } from "../rules/success";
import { formatSuccess } from "../utils/helper";

export interface EmokloreRollOptions extends RollOptions {
  successMod?: number;
  dmFormula?: string;
  target?: number;
}

export class EmokloreRoll extends foundry.dice.Roll {
  successMod: number;
  dmFormula: string;
  target: number;

  constructor(
    formula: string = "1d10",
    data: Record<string, unknown> = {},
    options: EmokloreRollOptions = {},
  ) {
    super(formula, data as any, options);
    const { successMod = 0, dmFormula = "", target = 10 } = options;
    this.successMod = successMod;
    this.dmFormula = dmFormula;
    this.target = target;
  }

  // 注意: ここで全結果に success を立てることが EmokloreDie.getResultCSS と暗黙に結合している。
  // 本体の Die は success/failure が付いていると min/max のCSSクラスを出さないため、
  // EmokloreDie 側でそのガードを意図的に外している。どちらかだけを変更すると出目の
  // 強調表示が壊れるので、両方セットで見ること
  override async evaluate(options?: any): Promise<any> {
    const roll = await super.evaluate(options);

    for (const term of roll.terms as any[]) {
      if (term && Array.isArray(term.results)) {
        term.results = term.results.map((r: any) => ({
          ...r,
          success: r.result <= this.target,
        }));
      }
    }
    return roll;
  }

  get diceResults(): number[] {
    const diceResults: number[] = [];
    (this.terms as any[]).forEach((term) => {
      if (Array.isArray(term.results)) {
        diceResults.push(...term.results.map((r: any) => r.result));
      }
    });
    return diceResults;
  }

  get rawResult(): number {
    return countSuccesses(this.diceResults, this.target);
  }

  get rollResult(): number {
    return this.rawResult + this.successMod;
  }

  get resultName(): ResultName {
    return resolveResultName(this.rollResult);
  }

  override async _prepareChatRenderContext(
    options?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const baseContext = await super._prepareChatRenderContext(options);
    return {
      ...baseContext,
      result: this.rollResult,
      resultName: this.resultName,
      successMod: this.successMod,
      dmFormula: this.dmFormula,
    };
  }

  override async getTooltip(): Promise<string> {
    const parts = this.dice.map((d) => d.getTooltipData());
    return foundry.applications.handlebars.renderTemplate(
      (this.constructor as typeof EmokloreRoll).TOOLTIP_TEMPLATE,
      {
        parts,
        result: formatSuccess(this.rawResult, this.successMod),
      },
    );
  }

  static override readonly CHAT_TEMPLATE = systemPath("templates/rolls/skill.hbs");
  static override readonly TOOLTIP_TEMPLATE = systemPath("templates/rolls/tooltip.hbs");
}
