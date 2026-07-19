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
 * キャンセルされた場合は null を返す。
 */
export async function promptResonanceRoll(): Promise<ResonanceRollInput | null> {
  const content = await foundry.applications.handlebars.renderTemplate(TEMPLATE, {});

  // prompt の型は config.ok を含んでおらず（本体JSDocの制約）そのままでは渡せない
  const prompt = foundry.applications.api.DialogV2.prompt as (
    config: Record<string, unknown>,
  ) => Promise<ResonanceRollInput>;

  try {
    return await prompt({
      window: { title: "〈♾️共鳴〉判定" },
      content,
      ok: {
        label: "ロール",
        callback: (_event: Event, button: HTMLElement) => readInput(button),
      },
      rejectClose: true,
    });
  } catch {
    // rejectClose: true なので、閉じられた場合は例外で戻ってくる
    return null;
  }
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
