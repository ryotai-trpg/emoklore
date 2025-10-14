import { systemPath } from "../constants";
import { formatSuccess } from "../helpers/helper";


export interface EmokloreRollOptions extends foundry.dice.Roll.Options {
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
    options: EmokloreRollOptions = {}
  ) {
    super(formula, data, options);
    const { successMod=0, dmFormula, target=10 } = options;
    this.successMod = successMod;
    this.dmFormula = dmFormula;
    this.target = target;
  }

  async evaluate(options) {
    const roll = await super.evaluate(options);

    for (const term of roll.terms) {
      if (term.results) {
        term.results = term.results.map((r) => ({
          ...r,
          success: r.result <= this.target,
          // failure: r.result > this.target,
        }));
      }
    }
    return roll;
  }

  get diceResults(): number[] {
    const diceResults = new Array();
    this.terms.forEach((term) => {
      diceResults.push(...term.results.map((r) => r.result));
    });
    return diceResults;
  }

  get rawResult(): number {
    const diceResults = this.diceResults;

    const base_count = diceResults.filter((diceResult) => diceResult <= this.target).length;
    const critical_count = diceResults.filter((diceResult) => diceResult <= 1).length;
    const error_count = diceResults.filter((diceResult) => diceResult >= 10).length;

    return base_count + critical_count - error_count;
  }

  get result(): number {
    return this.rawResult + this.successMod;
  }

  get resultName(): string {
    const success_count = this.result;
    let resultName;
    if (success_count < 0) {
      resultName = "fumble";
    } else if (success_count == 0) {
      resultName = "failure";
    } else if (success_count == 1) {
      resultName = "single";
    } else if (success_count == 2) {
      resultName = "double";
    } else if (success_count == 3) {
      resultName = "triple";
    } else if (success_count < 10) {
      resultName = "miracle";
    } else if (success_count >= 10) {
      resultName = "catastrophe";
    } else {
      resultName = "error!";
    }
    return resultName;
  }

  async _prepareChatRenderContext(
    options?: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const context = await super._prepareChatRenderContext(options);
    context.result = this.result;
    context.resultName = this.resultName;
    context.successMod = this.successMod;
    context.dmFormula = this.dmFormula;
    return context;
  }

  async getTooltip() {
    const parts = this.dice.map((d) => d.getTooltipData());
    return foundry.applications.handlebars.renderTemplate(this.constructor.TOOLTIP_TEMPLATE, {
      parts,
      result: formatSuccess(this.rawResult, this.successMod),
    });
  }

  static readonly CHAT_TEMPLATE = systemPath("templates/rolls/skill.hbs");
  static readonly TOOLTIP_TEMPLATE = systemPath("templates/rolls/tooltip.hbs");
}
