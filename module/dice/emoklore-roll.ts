import type { RollOptions } from "@client/dice/_types.mjs";
import { systemPath } from "../constants";
import { type ResultName, resolveResultName } from "../rules/success";
import type { RollSpec } from "../rules/types";
import { SUCCESS_MODIFIER } from "./emoklore-die";

export interface EmokloreRollOptions extends RollOptions {
  dmFormula?: string;
}

export class EmokloreRoll extends foundry.dice.Roll {
  /** チャットに出す「2DM≦6」形式の式。判定の内訳を見せるためのもので、評価には使わない */
  dmFormula: string;

  constructor(
    formula: string = "1d10",
    data: Record<string, unknown> = {},
    options: EmokloreRollOptions = {},
  ) {
    super(formula, data, options);
    this.dmFormula = options.dmFormula ?? "";
  }

  /**
   * 判定内容からRollを組み立てる。
   *
   * 成功数モディファイアと成功数修正を式に含めるので、評価すると `total` が最終的な成功数になる。
   */
  static fromSpec(spec: RollSpec, options: EmokloreRollOptions = {}): EmokloreRoll {
    const dice = `${spec.diceCount}d10${SUCCESS_MODIFIER}<=${spec.target}`;
    const successMod = spec.successMod === 0 ? "" : ` ${formatSigned(spec.successMod)}`;

    return new this(`${dice}${successMod}`, {}, { ...options, dmFormula: spec.dmFormula });
  }

  /** 成功数。修正値まで含めた最終的な値 */
  get successCount(): number {
    return this.total ?? 0;
  }

  get resultName(): ResultName {
    return resolveResultName(this.successCount);
  }

  override async _prepareChatRenderContext(
    options?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const baseContext = await super._prepareChatRenderContext(options);
    return {
      ...baseContext,
      resultName: this.resultName,
      dmFormula: this.dmFormula,
    };
  }

  static override readonly CHAT_TEMPLATE = systemPath("templates/rolls/skill.hbs");
}

/** 数式の項として書ける形にする。`1` → `+ 1`、`-1` → `- 1` */
function formatSigned(value: number): string {
  return `${value > 0 ? "+" : "-"} ${Math.abs(value)}`;
}
