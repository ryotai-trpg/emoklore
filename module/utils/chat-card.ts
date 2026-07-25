/**
 * チャットカードのボタン配線。
 *
 * 本体のチャットログは自前のアクション表しか見ないので、システム側のボタンは
 * メッセージが描かれるたびに自分で拾う必要がある。その拾い方はカードの種類に
 * よらず同じ形なので、ここに1つだけ置く。
 *
 * カードごとに違うのは、根の要素・アクションの表・失敗したときの文言だけ。
 */

/**
 * カードの1ボタンぶんの処理。
 *
 * `this` はカードのデータモデルに束縛され、押した要素を引数で受け取る。1枚に対象ぶんの
 * ボタンが並ぶカード（境界の案内・生存リマインダ）は、どの行のボタンかを要素の dataset
 * からしか特定できない。要素を要らないカードは受け取らなければよい。
 */
export type CardAction<M> = (this: M, target: HTMLElement) => Promise<void>;

export type CardActions<M> = Record<string, CardAction<M>>;

/**
 * カードのボタンにリスナを張る。
 *
 * リスナは根に1つだけ張り、`data-action` で振り分ける。ボタンを増やしても配線は増えない。
 *
 * @param html   `renderChatMessageHTML` が渡すメッセージの要素
 * @param root   カードの根を指すセレクタ。見つからなければ何もしない
 * @param model  ハンドラの `this` に束縛するデータモデル
 * @param actions `data-action` の値から処理を引く表。モジュールはここに足せる
 * @param type   ChatMessage のサブタイプ。失敗したときの表示名をここから引く
 */
export function attachCardActions<M>(
  html: HTMLElement,
  {
    root,
    model,
    actions,
    type,
  }: {
    root: string;
    model: M;
    actions: CardActions<M>;
    type: string;
  },
): void {
  const card = html.querySelector(root);
  if (!card) return;

  card.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-action]");
    const actionName = target?.dataset.action;
    if (!target || !actionName) return;

    const action = actions[actionName];
    if (!action) return;

    // 連打で二重に走らせない。処理中はボタンを落とし、成否によらず必ず戻す
    const button = target instanceof HTMLButtonElement ? target : null;
    if (button) button.disabled = true;

    action
      .call(model, target)
      .catch((error: unknown) => {
        // 本体が i18nInit で TYPES.ChatMessage.<種別> を typeLabels に入れる。
        // カードごとに表示名を持たなくても、種別から引ける
        const cardName = game.i18n.localize(CONFIG.ChatMessage.typeLabels[type] ?? type);
        console.error(`emoklore | ${cardName}の操作に失敗しました`, error);
        ui.notifications?.error("EMOKLORE.ChatMessage.Common.ActionFailed", {
          format: { card: cardName },
        });
      })
      .finally(() => {
        if (button) button.disabled = false;
      });
  });
}
