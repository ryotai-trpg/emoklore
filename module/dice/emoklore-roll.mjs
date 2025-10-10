import { systemPath } from "../constants.mjs";

export class EmokloreRoll extends foundry.dice.Roll {
  constructor(formula = "1d10", data = {}, options = {}) {
    super(formula, data, options);
    const { baseTarget, targetModifier, successModifier, skillName, bonus, level } = options;
    this.successModifier = successModifier;
    this.skillName = skillName;
    this.bonus = bonus;
    this.level = level;
    this.baseTarget = baseTarget;
    this.targetModifier = targetModifier;
  }

  get target() {
    return this.baseTarget + this.targetModifier;
  }

  get total() {
    return super.total;
  }

  get diceResults() {
    const diceResults = new Array();
    this.terms.forEach((term) => {
      diceResults.push(...term.results.map((r) => r.result));
    });
    return diceResults;
  }

  get result() {
    const diceResults = this.diceResults;

    const base_count = diceResults.filter((diceResult) => diceResult <= this.target).length;
    const critical_count = diceResults.filter((diceResult) => diceResult <= 1).length;
    const error_count = diceResults.filter((diceResult) => diceResult >= 10).length;

    const success_count = base_count + critical_count - error_count;
    return success_count + this.successModifier;
  }

  get resultName() {
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
    } else {
      resultName = "catastrophe";
    }
    return resultName;
  }

  async _prepareChatRenderContext(options) {
    const context = await super._prepareChatRenderContext(options);
    context.result = this.result;
    context.resultName = this.resultName;
    context.successModifier = this.successModifier;
    context.bonus = this.bonus;
    context.skillName = this.skillName;
    context.level = this.level;
    context.baseTarget = this.baseTarget;
    context.targetModifier =
      this.targetModifier > 0 ? `+${this.targetModifier}` : this.targetModifier;

    // console.log(`${this.formula.split("d")[0]}DM<=${this.baseTarget}${context.targetModifier}`)
    // HACK: 書き直す
    return context;
  }

  static CHAT_TEMPLATE = systemPath("templates/rolls/skill.hbs");
  static TOOLTIP_TEMPLATE = systemPath("templates/rolls/tooltip.hbs");
}
