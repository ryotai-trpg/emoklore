import { systemPath } from '../constants.mjs';

export class EmokloreRoll extends foundry.dice.Roll {
  constructor(formula = "1d10", data = {}, options = {}) {
    super(formula, data, options);
    const { target } = options;
    this.target = target;
  }

  get total() {
    return super.total
    // return this.result
  }

  get diceResults() {
    const diceResults = new Array();
    this.terms.forEach(term => {
      diceResults.push(...term.results.map(r => r.result));
    });
    return diceResults
  }

  get result() {
    const diceResults = this.diceResults

    const base_count = (diceResults.filter((diceResult) => diceResult <= this.target).length)
    const critical_count = (diceResults.filter((diceResult) => diceResult <= 1).length)
    const error_count = (diceResults.filter((diceResult) => diceResult >= 10).length)

    const success_count = base_count +critical_count - error_count
    return success_count
  }

  async _prepareChatRenderContext(options) {
    const context = await super._prepareChatRenderContext(options)
    context.result = this.result
    return context
  }

  static CHAT_TEMPLATE = systemPath("templates/rolls/skill.hbs");
  static TOOLTIP_TEMPLATE = systemPath("templates/rolls/tooltip.hbs");


}
