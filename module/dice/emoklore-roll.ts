import type { RollOptions } from "@client/dice/_types.mjs";
import { systemPath } from "../constants";
import { meetsRequirement, type ResultName, resolveResultName } from "../rules/success";
import type { RollSpec } from "../rules/types";
import { SUCCESS_MODIFIER } from "./emoklore-die";

export interface EmokloreRollOptions extends RollOptions {
  dmFormula?: string;
  successMod?: number;
  requiredSuccess?: number;
}

export class EmokloreRoll extends foundry.dice.Roll {
  /** チャットに出す「2DM≦6」形式の式。判定の内訳を見せるためのもので、評価には使わない */
  dmFormula: string;

  /**
   * 成功数修正。式にも項として入っているので評価には要らないが、
   * 「ダイスの成功数いくつに、いくつ足したのか」を表示するために保持する
   */
  successMod: number;

  /**
   * DLが要求した成功数。0は要求なし。
   *
   * カードではなくロールが持つ。GMが出した要求カードはPLから更新できない
   * （`ChatMessage#getUserLevel` は作成者にしかOWNERを返さない）ので、到達を
   * カード側に書き戻す形にすると委譲が1往復要る。ロールのオプションはメッセージと
   * 一緒に保存されるので、再描画しても残る
   */
  requiredSuccess: number;

  constructor(
    formula: string = "1d10",
    data: Record<string, unknown> = {},
    options: EmokloreRollOptions = {},
  ) {
    super(formula, data, options);
    this.dmFormula = options.dmFormula ?? "";
    this.successMod = options.successMod ?? 0;
    this.requiredSuccess = options.requiredSuccess ?? 0;
  }

  /**
   * 判定内容からRollを組み立てる。
   *
   * 成功数モディファイアと成功数修正を式に含めるので、評価すると `total` が最終的な成功数になる。
   */
  static fromSpec(spec: RollSpec, options: EmokloreRollOptions = {}): EmokloreRoll {
    const dice = `${spec.diceCount}d10${SUCCESS_MODIFIER}<=${spec.target}`;
    const successMod = spec.successMod === 0 ? "" : ` ${formatTerm(spec.successMod)}`;

    return new this(`${dice}${successMod}`, {}, {
      ...options,
      dmFormula: spec.dmFormula,
      successMod: spec.successMod,
    } satisfies EmokloreRollOptions);
  }

  /** 成功数。修正値まで含めた最終的な値 */
  get successCount(): number {
    return this.total ?? 0;
  }

  get resultName(): ResultName {
    return resolveResultName(this.successCount);
  }

  /** 判定結果の表示。チャットカードの見出しに出る「成功」「ダブル」など */
  get resultLabel(): string {
    return game.i18n.localize(`EMOKLORE.result.${this.resultName}`);
  }

  /** 成功数修正の表示。修正がなければ空文字 */
  get successModLabel(): string {
    if (this.successMod === 0) return "";
    return game.i18n.localize("EMOKLORE.successMod", { mod: formatSigned(this.successMod) });
  }

  /** 要求された成功数への到達の表示。要求がなければ空文字 */
  get requirementLabel(): string {
    if (this.requiredSuccess <= 0) return "";

    const requirement = game.i18n.localize("EMOKLORE.RollOptions.AtLeast", {
      result: game.i18n.localize(`EMOKLORE.result.${resolveResultName(this.requiredSuccess)}`),
    });
    const key = meetsRequirement(this.successCount, this.requiredSuccess)
      ? "EMOKLORE.RollOptions.Met"
      : "EMOKLORE.RollOptions.Missed";

    return game.i18n.localize(key, { requirement });
  }

  /**
   * ツールチップのダイス合計を「3+1」形式にする。
   *
   * 本体のテンプレートは各パートの `total` をそのまま出すだけなので、
   * テンプレートを差し替えずにここで値を作り替えれば済む。
   */
  override async getTooltip(): Promise<string> {
    const parts: Record<string, unknown>[] = this.dice.map((die) => ({ ...die.getTooltipData() }));
    const [diceTerm] = parts;

    if (diceTerm && this.successMod !== 0) {
      diceTerm.total = `${diceTerm.total}${formatSigned(this.successMod)}`;
    }

    return foundry.applications.handlebars.renderTemplate(
      (this.constructor as typeof EmokloreRoll).TOOLTIP_TEMPLATE,
      { parts },
    );
  }

  override async _prepareChatRenderContext(
    options?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const baseContext = await super._prepareChatRenderContext(options);
    return {
      ...baseContext,
      resultLabel: this.resultLabel,
      dmFormula: this.dmFormula,
      successModLabel: this.successModLabel,
      requirementLabel: this.requirementLabel,
    };
  }

  static override readonly CHAT_TEMPLATE = systemPath("templates/rolls/skill.hbs");
}

/** 符号を付ける。`1` → `+1`、`-1` → `-1` */
function formatSigned(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

/** 数式の項として書ける形にする。`1` → `+ 1`、`-1` → `- 1` */
function formatTerm(value: number): string {
  return `${value > 0 ? "+" : "-"} ${Math.abs(value)}`;
}
