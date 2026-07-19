export class EmokloreDie extends foundry.dice.terms.Die {
  /**
   * 本体の実装から2点、意図的に変えている。
   *
   * 1. 本体は success/failure が付いていると min/max を出さないが、EmokloreRoll.evaluate が
   *    全結果に success を立てるためそのままでは min/max が消える。ここではガードを外して常に出す
   * 2. min と max を反転させている。エモクロアでは出目1がクリティカル（良い）・10がファンブル
   *    （悪い）で、本体CSSは .max を「良い出目」の見た目にしているため
   */
  override getResultCSS(result: {
    result: number;
    success?: boolean;
    failure?: boolean;
    rerolled?: boolean;
    exploded?: boolean;
    discarded?: boolean;
  }): string[] {
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
      isMax ? "min" : null,
    ].filter((x): x is string => Boolean(x));
  }
}
