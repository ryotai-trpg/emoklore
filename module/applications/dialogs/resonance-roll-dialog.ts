import { isResonantEmotionKey } from "../../config/resonant-emotions";
import { systemPath } from "../../constants";
import type { OwnedEmotions } from "../../rules/emotion-match";
import { normalizeIntensity, type ResonanceMatch } from "../../rules/resonance-roll";
import { formatEmotion, matchEmotion } from "../../utils/emotion";
import { EmotionPicker } from "../emotion-picker";

export type ResonanceRollInput = {
  intensity: number;
  emotionMatch: ResonanceMatch;
};

const TEMPLATE = systemPath("templates/apps/resonance-roll.hbs");

/**
 * 共鳴判定の強度と共鳴感情を尋ねる。
 *
 * キャンセルされた場合は null を返す。`intensity` を渡すと強度の初期値になる
 * （怪異シートが共鳴プリセットの強度を差し込む導線。#75 で全共鳴者への要求カードになる）。
 *
 * **一致度は選んだ感情から自動で決まる。** DLは「∞共鳴感情：[憧憬（理想）]」の形で
 * 感情そのものを指定するので、PLが一致度を読み替える手間を省く。読み替えを自分で
 * したいとき（DLがマッチングを強制する場合など）のために、手動の3択も残してある。
 *
 * @param owned 判定するアクターの共鳴感情。自動判定の突き合わせ先
 */
export async function promptResonanceRoll({
  intensity,
  owned,
  emotion = "",
}: {
  intensity?: number;
  owned: OwnedEmotions;
  emotion?: string;
}): Promise<ResonanceRollInput | null> {
  const content = await foundry.applications.handlebars.renderTemplate(TEMPLATE, {
    intensity,
    emotion,
    emotionLabel: formatEmotion(emotion),
  });

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
      callback: (_event: Event, button: HTMLElement) => readInput(button, owned),
    },
    // content 内の data-action は ApplicationV2 のアクション機構がここに振り分ける
    actions: {
      pickEmotion: (_event: Event, button: HTMLElement) => pickEmotion(button),
    },
    // 閉じられた場合はnullで返る。rejectCloseで例外にすると本物のエラーを握り潰しやすい
    rejectClose: false,
  } as Parameters<typeof foundry.applications.api.DialogV2.prompt>[0]);

  return (result as ResonanceRollInput | null) ?? null;
}

/** シートと同じピッカーで感情を選び、hidden とボタンの表示に書き戻す */
async function pickEmotion(button: HTMLElement): Promise<void> {
  const form = (button as HTMLButtonElement).form as HTMLFormElement;
  const field = form.elements.namedItem("emotion") as HTMLInputElement;

  const picked = await EmotionPicker.pickSlots([
    {
      key: "emotion",
      label: game.i18n.localize("EMOKLORE.EmotionPicker.Title"),
      // hidden の値は前回の選択かプリセット。感情キーとして名乗る前に確かめる
      value: isResonantEmotionKey(field.value) ? field.value : null,
    },
  ]);
  if (!picked) return;

  const emotion = picked.emotion ?? "";
  field.value = emotion;

  const label = button.querySelector("[data-emotion-label]");
  if (label) {
    label.textContent =
      formatEmotion(emotion) || game.i18n.localize("EMOKLORE.EmotionPicker.Unselected");
  }
}

/**
 * フォームの入力を読む。
 *
 * **ここでは弾かない。** 本体の `_onSubmit` は `(await callback()) ?? button.action` と
 * 書かれており、callback が null を返すと結果が文字列 `"ok"` にすり替わる。
 * 強度は `normalizeIntensity` で正規化して必ずオブジェクトを返す。
 */
function readInput(button: HTMLElement, owned: OwnedEmotions): ResonanceRollInput {
  const form = (button as HTMLButtonElement).form as HTMLFormElement;
  const intensity = (form.elements.namedItem("intensity") as HTMLInputElement).valueAsNumber;
  const choice = (form.elements.namedItem("choice") as RadioNodeList).value;
  const emotion = (form.elements.namedItem("emotion") as HTMLInputElement).value;

  return {
    intensity: normalizeIntensity(intensity),
    emotionMatch: choice === "auto" ? matchEmotion(owned, emotion) : (choice as ResonanceMatch),
  };
}
