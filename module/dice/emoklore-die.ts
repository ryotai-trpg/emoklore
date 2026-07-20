import type { DiceTermResult } from "@client/dice/_types.mjs";
import { classifyFace, facePoints } from "../rules/success";

/** 式に書く成功数モディファイアのキー。`3d10em<=6` のように使う */
export const SUCCESS_MODIFIER = "em";

const MODIFIER_PATTERN = new RegExp(`^${SUCCESS_MODIFIER}<=(\\d+)$`, "i");

/**
 * エモクロアの成功数判定を担うDie。
 *
 * `CONFIG.Dice.terms.d` に登録するのでワールド中のすべての `d` 項がこのクラスになる。
 * 判定固有の挙動は `em<=目標値` モディファイアが付いたときだけに限定し、
 * 素の `1d20` などは本体のまま振る舞わせる。
 */
export class EmokloreDie extends foundry.dice.terms.Die {
  static override MODIFIERS = {
    ...foundry.dice.terms.Die.MODIFIERS,
    [SUCCESS_MODIFIER]: "emokloreSuccess",
  };

  /**
   * 各出目に成功数（`count`）と成否フラグを立てる。
   *
   * 本体の `DiceTerm#total` は `count` があればそれを合計するので、
   * これだけで `term.total` と `roll.total` が成功数になる。
   */
  emokloreSuccess(modifier: string): boolean | undefined {
    const target = EmokloreDie.#parseTarget(modifier);
    if (target === null) return false;

    for (const result of this.results) {
      const outcome = classifyFace(result.result, target);
      result.count = facePoints(outcome);
      result.success = outcome === "critical" || outcome === "success";
      result.failure = outcome === "fumble";
    }

    // 本体のmodifierは false を返したときだけ失敗扱いになる。
    // 成功時は undefined を返すのが規約なので、明示して返す
    return undefined;
  }

  /**
   * 判定ロールの出目にクリティカル・ファンブルのクラスを足す。
   *
   * 本体の min/max は「出目1が最悪・最大値が最良」という前提のクラスで、
   * エモクロアとは意味が逆になるので判定ロールでは落とす。成功・失敗の色分けは
   * `emokloreSuccess` が立てた success/failure に対する本体のクラスに任せる。
   */
  override getResultCSS(result: DiceTermResult): (string | null)[] {
    const target = this.#target;
    if (target === null) return super.getResultCSS(result);

    const classes = super.getResultCSS(result).filter((cls) => cls !== "min" && cls !== "max");
    const outcome = classifyFace(result.result, target);

    return [...classes, outcome === "critical" || outcome === "fumble" ? outcome : null];
  }

  /** ツールチップの式を、チャットカードと同じ「4DM≦7」記法にする */
  override getTooltipData(): ReturnType<foundry.dice.terms.Die["getTooltipData"]> {
    const data = super.getTooltipData();
    const target = this.#target;

    return target === null ? data : { ...data, formula: `${this.number}DM≦${target}` };
  }

  /**
   * 適用済みモディファイアから目標値を取り出す。判定ロールでなければ null。
   *
   * 評価後の再構築（チャットログの再描画など）ではモディファイアの評価は走らないが、
   * `modifiers` 自体は保存されるので、ここから引き直せば描画時にも目標値が得られる。
   */
  get #target(): number | null {
    for (const modifier of this.modifiers) {
      const target = EmokloreDie.#parseTarget(modifier);
      if (target !== null) return target;
    }
    return null;
  }

  static #parseTarget(modifier: string): number | null {
    const match = modifier.match(MODIFIER_PATTERN);
    return match?.[1] === undefined ? null : Number(match[1]);
  }
}
