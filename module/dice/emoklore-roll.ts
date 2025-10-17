import { systemPath } from "../constants";
import { formatSuccess } from "../helpers/helper";

export interface EmokloreRollOptions extends foundry.dice.Roll.Options {
  successMod?: number;
  dmFormula?: string;
  target?: number;
}

interface DiceResult {
  result: number;
  success?: boolean;
  failure?: boolean;
  rerolled?: boolean;
  exploded?: boolean;
  discarded?: boolean;
}

interface DiceTerm {
  results?: DiceResult[];
  [key: string]: unknown;
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

  override async evaluate(options?: any): Promise<any> {
    const roll = await super.evaluate(options);

    for (const term of roll.terms as any[]) {
      if (term && Array.isArray(term.results)) {
        term.results = term.results.map((r: any) => ({
          ...r,
          success: r.result <= this.target,
          // failure: r.result > this.target,
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
    const diceResults = this.diceResults;

    const base_count = diceResults.filter((diceResult) => diceResult <= this.target).length;
    const critical_count = diceResults.filter((diceResult) => diceResult <= 1).length;
    const error_count = diceResults.filter((diceResult) => diceResult >= 10).length;

    return base_count + critical_count - error_count;
  }

  get rollResult(): number {
    return this.rawResult + this.successMod;
  }

  get resultName(): string {
    const success_count = this.rollResult;
    let resultName: string;
    if (success_count < 0) {
      resultName = "fumble";
    } else if (success_count === 0) {
      resultName = "failure";
    } else if (success_count === 1) {
      resultName = "single";
    } else if (success_count === 2) {
      resultName = "double";
    } else if (success_count === 3) {
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
    options?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    // @ts-ignore - _prepareChatRenderContext exists but not in type definition
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
