import { systemPath } from "../../constants";
import { normalizeIntensity, type ResonanceMatch } from "../../rules/resonance-roll";

export type ResonanceRollInput = {
  intensity: number;
  emotionMatch: ResonanceMatch;
};

const TEMPLATE = systemPath("templates/apps/resonance-roll.hbs");

/**
 * 共鳴判定の強度と共鳴感情の一致度を尋ねる。
 *
 * キャンセルされた場合は null を返す。`intensity` を渡すと強度の初期値になる
 * （怪異シートが共鳴プリセットの強度を差し込む導線。#75 で全共鳴者への要求カードに置き換わる）。
 */
export async function promptResonanceRoll({
  intensity,
}: {
  intensity?: number;
} = {}): Promise<ResonanceRollInput | null> {
  const content = await foundry.applications.handlebars.renderTemplate(TEMPLATE, { intensity });

  // prompt は static メソッドで中身が this.wait(...) なので、変数に取り出して呼ぶと
  // thisが外れて壊れる。必ずメソッドとして呼ぶこと。
  // キャストが要るのは、本体JSDocの引数型に config.ok が含まれていないため
  const result = await foundry.applications.api.DialogV2.prompt({
    // DialogV2 の既定の classes は ["dialog"] だけで emoklore も standard-form も
    // 付かない。本体のフォーム体系に乗せるには明示的に渡す必要がある
    classes: ["emoklore", "standard-form"],
    window: {
      title: game.i18n.localize("EMOKLORE.skillRoll", {
        skillName: game.i18n.localize("EMOKLORE.Resonance.Name"),
      }),
    },
    content,
    ok: {
      label: game.i18n.localize("EMOKLORE.Resonance.RollButton"),
      callback: (_event: Event, button: HTMLElement) => readInput(button),
    },
    // 閉じられた場合はnullで返る。rejectCloseで例外にすると本物のエラーを握り潰しやすい
    rejectClose: false,
  } as Parameters<typeof foundry.applications.api.DialogV2.prompt>[0]);

  return (result as ResonanceRollInput | null) ?? null;
}

function readInput(button: HTMLElement): ResonanceRollInput {
  const form = (button as HTMLButtonElement).form as HTMLFormElement;
  const intensity = (form.elements.namedItem("intensity") as HTMLInputElement).valueAsNumber;
  const emotionMatch = (form.elements.namedItem("choice") as RadioNodeList).value;

  return {
    intensity: normalizeIntensity(intensity),
    emotionMatch: emotionMatch as ResonanceMatch,
  };
}
