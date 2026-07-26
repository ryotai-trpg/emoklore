/**
 * チャット欄に足すDL用のボタン。
 *
 * v14 は入力欄まわりの要素を `renderChatInput` で渡してくる
 * （`client/applications/sidebar/tabs/chat.mjs` の `_toggleNotifications`）。
 * `#chat-controls` は `ChatLog` の要素の**外**にあり、通知の表示状態で親が付け替わるので、
 * `renderChatLog` を待つ形だと掴めない。
 */

import { requestResonanceCheck, requestSkillCheck } from "./requests";

/**
 * 差すボタン。目印のクラスで二重を防ぐ（要素は使い回されたまま親だけが移る）。
 * `cls` は**掴むためだけのクラスで、CSSの規則は持たない**。見た目は本体のボタンに任せる
 */
const BUTTONS = [
  {
    cls: "em-request-skill",
    icon: "fa-hand-point-right",
    label: "EMOKLORE.SkillRequest.Title",
    run: requestSkillCheck,
  },
  {
    cls: "em-request-resonance",
    icon: "fa-tower-broadcast",
    label: "EMOKLORE.SkillRequest.ResonanceTitle",
    run: requestResonanceCheck,
  },
];

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
  if (!controls) return;

  // DL用のボタン（書き出し・削除）の並びに置く。無ければ末尾に足す
  const place = controls.querySelector(".control-buttons") ?? controls;

  for (const { cls, icon, label, run } of BUTTONS) {
    if (controls.querySelector(`.${cls}`)) continue;

    const button = document.createElement("button");
    button.type = "button";
    button.className = `ui-control icon fa-solid ${icon} ${cls}`;
    button.dataset.tooltip = "";
    button.ariaLabel = _loc(label);
    button.addEventListener("click", () => {
      void run();
    });

    place.append(button);
  }
}
