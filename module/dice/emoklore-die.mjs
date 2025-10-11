export class EmokloreDie extends foundry.dice.terms.Die {
   getResultCSS(result) {
    const isMax = result.result === this.faces;
    const isMin = result.result === 1;
    return [
      this.constructor.name.toLowerCase(),
      `d${this.faces}`,
      result.success ? "success" : null,
      result.failure ? "failure" : null,
      result.rerolled ? "rerolled" : null,
      result.exploded ? "exploded" : null,
      result.discarded ? "discarded" : null,
      isMin ? "max" : null,
      isMax ? "min" : null
    ];
  }
}
