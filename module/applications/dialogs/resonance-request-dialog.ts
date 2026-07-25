import { isResonantEmotionKey } from "../../config/resonant-emotions";
import { systemPath } from "../../constants";
import { formatEmotion } from "../../utils/emotion";
import type { ResonanceRequestState } from "../../utils/resonance";
import { resolveActingActors } from "../../utils/targets";
import { EmotionPicker } from "../emotion-picker";

const TEMPLATE = systemPath("templates/apps/resonance-request.hbs");

/**
 * DLが共鳴判定・憑依判定の要求内容を決める。
 *
 * キャンセルされた場合は null を返す。`preset` は怪異シートが共鳴プリセット
 * （強度・上昇値・感情・共鳴表）を差し込む導線。
 *
 * 対象は選択中のトークンから拾って焼き込む。ここで焼くのは表示のためで、押せる相手を
 * 絞るためではない（カードは全員に配られ、各自が自分のアクターで振る）。
 */
export async function promptResonanceRequest(
  preset: Partial<ResonanceRequestState> = {},
): Promise<ResonanceRequestState | null> {
  const emotion = preset.emotion ?? "";
  const content = await foundry.applications.handlebars.renderTemplate(TEMPLATE, {
    intensity: preset.intensity ?? 5,
    rise: preset.rise ?? "1",
    emotion,
    emotionLabel: formatEmotion(emotion),
    possessionMode: preset.possessionMode ?? false,
  });

  // 押した瞬間の選択を対象として焼き込む。ダイアログを開いている間に選び直されても、
  // カードに出る名前と DL が意図した相手が食い違わないようにするため
  const targets = resolveActingActors()
    .filter((actor) => actor.isCharacter())
    .map((actor) => ({ actorUuid: actor.uuid ?? null, name: actor.name ?? "" }));

  // prompt は static メソッドで中身が this.wait(...) なので、変数に取り出して呼ぶと
  // thisが外れて壊れる。必ずメソッドとして呼ぶこと。
  // キャストが要るのは、本体JSDocの引数型に config.ok が含まれていないため
  const result = await foundry.applications.api.DialogV2.prompt({
    // DialogV2 の既定の classes は ["dialog"] だけで emoklore も standard-form も
    // 付かない。本体のフォーム体系に乗せるには明示的に渡す必要がある
    classes: ["emoklore", "standard-form"],
    window: { title: game.i18n.localize("EMOKLORE.SkillRequest.ResonanceTitle") },
    content,
    ok: {
      label: game.i18n.localize("EMOKLORE.SkillRequest.Post"),
      callback: (_event: Event, button: HTMLElement) =>
        readInput(button, targets, preset.kaiUuid ?? null),
    },
    // content 内の data-action は ApplicationV2 のアクション機構がここに振り分ける
    actions: {
      pickEmotion: (_event: Event, button: HTMLElement) => pickEmotion(button),
    },
    // 閉じられた場合はnullで返る。rejectCloseで例外にすると本物のエラーを握り潰しやすい
    rejectClose: false,
  } as Parameters<typeof foundry.applications.api.DialogV2.prompt>[0]);

  return (result as ResonanceRequestState | null) ?? null;
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
 * 強度は1未満に落とさず、上昇値の式の妥当性はスキーマの検証に任せる。
 */
function readInput(
  button: HTMLElement,
  targets: ResonanceRequestState["targets"],
  kaiUuid: string | null,
): ResonanceRequestState {
  const form = (button as HTMLButtonElement).form as HTMLFormElement;
  const intensity = Number((form.elements.namedItem("intensity") as HTMLInputElement).value);

  return {
    intensity: Number.isFinite(intensity) && intensity > 0 ? intensity : 1,
    rise: (form.elements.namedItem("rise") as HTMLInputElement).value.trim(),
    emotion: (form.elements.namedItem("emotion") as HTMLInputElement).value,
    forcedMatch: (form.elements.namedItem("forcedMatch") as HTMLSelectElement).value,
    possessionMode: (form.elements.namedItem("possessionMode") as HTMLInputElement).checked,
    targets,
    kaiUuid,
  };
}
