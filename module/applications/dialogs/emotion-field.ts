/**
 * ダイアログの中で共鳴感情を選ばせる入力。
 *
 * `DialogV2.prompt` の content は素のHTMLなので、選んだ結果を持つ場所が要る。hidden が
 * 保存するキーを持ち、表示は本体の `<multi-select>` と同じタグ（`.tags.input-element-tags`）で
 * 折り返す。感情名は長く数も決まらないので、1行に詰める入力では溢れる。
 *
 * 共鳴判定のダイアログ（PL側）とDLの要求作成ダイアログが同じ形を使う。
 */

import { isResonantEmotionKey } from "../../config/resonant-emotions";
import { systemPath } from "../../constants";
import { formatEmotion } from "../../utils/emotion";
import { EmotionPicker } from "../emotion-picker";

const TAGS_TEMPLATE = systemPath("templates/apps/partials/emotion-tags.hbs");
const FIELD_TEMPLATE = systemPath("templates/apps/partials/emotion-field.hbs");

/** hidden に詰めるときの区切り。感情キーは識別子なのでカンマとは衝突しない */
const SEPARATOR = ",";

/** hidden・タグ・ボタンをまとめた入れ物。押した要素からここを辿る */
const FIELD = ".em-emotion-field";

/**
 * 感情入力のpartialをHandlebarsに登録する。**ダイアログを開く前に必ず通すこと。**
 *
 * 本体が自動で読むのは ApplicationV2 の `PARTS.templates` だけで、`DialogV2.prompt` の
 * content は自前の `renderTemplate` を通るため、`{{> ...}}` の解決先が登録されていない。
 * **入れ子のpartialも再帰的には解決されない**ので、外側（field）と内側（tags）を両方並べる。
 * `getTemplate` はキャッシュするので、毎回呼んでも読み込みは1回で済む。
 */
export const loadEmotionFieldPartials = (): Promise<unknown[]> =>
  foundry.applications.handlebars.loadTemplates([FIELD_TEMPLATE, TAGS_TEMPLATE]);

/** hidden の値から感情キーを取り出す。保存値・前回の選択なので型述語を通す */
export const readEmotions = (form: HTMLFormElement): string[] =>
  (form.elements.namedItem("emotions") as HTMLInputElement).value
    .split(SEPARATOR)
    .filter(isResonantEmotionKey);

/** テンプレートに渡すタグの並び。ピッカー側と同じ形 */
export const buildEmotionTags = (
  emotions: Iterable<string>,
): Array<{ key: string; label: string }> =>
  [...emotions].map((key) => ({ key, label: formatEmotion(key) }));

/**
 * ピッカーを開いて感情を選び直す。
 *
 * 《怪異》は共鳴感情を複数持つので複数選択モードで開く。DLは持っている感情を
 * まとめて鳴らせて、共鳴者はそのどれかに一致すればよい。
 */
export async function pickEmotionsInto(button: HTMLElement): Promise<void> {
  const form = (button as HTMLButtonElement).form as HTMLFormElement;

  const picked = await EmotionPicker.pickMany(readEmotions(form));
  if (!picked) return;

  await writeEmotions(button, picked);
}

/** タグの×で1つ外す */
export async function removeEmotionFrom(target: HTMLElement): Promise<void> {
  const key = target.closest<HTMLElement>(".tag")?.dataset.key;
  const form = target.closest("form");
  if (!key || !form) return;

  await writeEmotions(
    target,
    readEmotions(form).filter((emotion) => emotion !== key),
  );
}

/**
 * hidden とタグの表示を同じ値で書き換える。
 *
 * 片方だけ更新すると、見えている選択と保存される値が食い違う。書き込み口を1つにして、
 * その組み合わせを作れなくしてある。
 */
async function writeEmotions(origin: HTMLElement, emotions: string[]): Promise<void> {
  const field = origin.closest(FIELD);
  const hidden = field?.querySelector<HTMLInputElement>('input[name="emotions"]');
  const tags = field?.querySelector(".tags");
  if (!hidden || !tags) return;

  hidden.value = emotions.join(SEPARATOR);
  tags.outerHTML = await foundry.applications.handlebars.renderTemplate(TAGS_TEMPLATE, {
    tags: buildEmotionTags(emotions),
  });
}
