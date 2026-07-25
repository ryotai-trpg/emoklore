/**
 * チャット欄に足すDL用のボタン。
 *
 * v14 は入力欄まわりの要素を `renderChatInput` で渡してくる
 * （`client/applications/sidebar/tabs/chat.mjs` の `_toggleNotifications`）。
 * `#chat-controls` は `ChatLog` の要素の**外**にあり、通知の表示状態で親が付け替わるので、
 * `renderChatLog` を待つ形だと掴めない。
 */

import { requestSkillCheck } from "./requests";

/** 差したボタンの目印。付け替えのたびに呼ばれるので、これで二重を防ぐ */
const BUTTON_CLASS = "em-request-skill";

/** 本体の型に出ないメンバーだけを補う */
type GamemasterUser = { isGM: boolean };

/**
 * DLだけに見える「判定を要求」ボタンを `#chat-controls` に差す。
 *
 * **冪等にする。** 要素は使い回されたまま親だけが移るので、素直に append すると
 * 通知の開閉のたびにボタンが増える。
 */
export function injectChatControls(elements: Record<string, HTMLElement>): void {
  if (!(game.user as GamemasterUser | null | undefined)?.isGM) return;

  const controls = elements["#chat-controls"];
  if (!controls || controls.querySelector(`.${BUTTON_CLASS}`)) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = `ui-control icon fa-solid fa-hand-point-right ${BUTTON_CLASS}`;
  button.dataset.tooltip = "";
  button.ariaLabel = game.i18n.localize("EMOKLORE.SkillRequest.Title");
  button.addEventListener("click", () => {
    void requestSkillCheck();
  });

  // DL用のボタン（書き出し・削除）の並びに置く。無ければ末尾に足す
  (controls.querySelector(".control-buttons") ?? controls).append(button);
}
