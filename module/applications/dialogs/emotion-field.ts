/**
 * ダイアログの中で共鳴感情を選ばせる入力。
 *
 * `DialogV2.prompt` の content は素のHTMLなので、選んだ結果を持つ場所が要る。
 * hidden が保存するキーを持ち、ボタンは表示とピッカーの起動だけを担う。
 *
 * 共鳴判定のダイアログ（PL側）とDLの要求作成ダイアログが同じ形を使う。
 */

import { isResonantEmotionKey } from "../../config/resonant-emotions";
import { formatEmotions } from "../../utils/emotion";
import { EmotionPicker } from "../emotion-picker";

/** hidden に詰めるときの区切り。感情キーは識別子なのでカンマとは衝突しない */
const SEPARATOR = ",";

/** hidden の値から感情キーを取り出す。保存値・前回の選択なので型述語を通す */
export const readEmotions = (form: HTMLFormElement): string[] =>
  (form.elements.namedItem("emotions") as HTMLInputElement).value
    .split(SEPARATOR)
    .filter(isResonantEmotionKey);

/**
 * ピッカーを開いて感情を選び直し、hidden とボタンの表示に書き戻す。
 *
 * 《怪異》は共鳴感情を複数持つので複数選択モードで開く。DLは持っている感情を
 * まとめて鳴らせて、共鳴者はそのどれかに一致すればよい。
 */
export async function pickEmotionsInto(button: HTMLElement): Promise<void> {
  const form = (button as HTMLButtonElement).form as HTMLFormElement;
  const field = form.elements.namedItem("emotions") as HTMLInputElement;

  const picked = await EmotionPicker.pickMany(readEmotions(form));
  if (!picked) return;

  field.value = picked.join(SEPARATOR);

  const label = button.querySelector("[data-emotion-label]");
  if (label) {
    label.textContent =
      formatEmotions(picked) || game.i18n.localize("EMOKLORE.EmotionPicker.Unselected");
  }
}
