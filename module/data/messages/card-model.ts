import { attachCardActions, type CardActions } from "../../utils/chat-card";
import { EmokloreSystemDataModel } from "../system-model";

/**
 * ChatMessage のサブタイプ。**`system.json` の `documentTypes.ChatMessage` と必ず揃える。**
 *
 * 宣言していない種別で作ると本体が system を素のオブジェクトに落とすので、
 * `addListeners` が生えずボタンが死ぬ。
 */
export type CardType =
  | "weapon"
  | "kaiAttack"
  | "damageApplied"
  | "survivalReminder"
  | "skillRequest"
  | "resonanceRequest"
  | "resonanceOutcome"
  | "howlingDraw";

/** カードごとに違うのはこの3つだけ。配線そのものは基底が持つ */
export type CardIdentity = {
  /** カードの根を指すセレクタ。見つからなければ配線しない */
  root: string;
  /** 失敗をコンソールに出すときのカード名（日本語） */
  label: string;
  /** 失敗を通知に出すときの言語キー */
  errorKey: string;
};

/**
 * チャットカードのChatMessageサブタイプの基底。
 *
 * ボタンの配線（`renderChatMessageHTML` → `addListeners` → `attachCardActions`）は
 * カードの種類によらず同じ形なので、ここに1つだけ置く。サブクラスが持つのは
 * `CARD`（目印）と `ACTIONS`（`data-action` から処理を引く表）の2つ。
 *
 * **`ACTIONS` を基底で宣言しない。** `CardActions<M>` の `M` はサブクラス自身に
 * 束ねたいので、基底に置くとハンドラの `this` が基底止まりになる。
 */
export class ChatCardModel extends EmokloreSystemDataModel {
  declare static CARD: CardIdentity;

  /**
   * `data-action` の値から処理を引く表。モジュールはここに足せる。
   *
   * サブクラスは自分の型で名乗り直す（ハンドラの `this` がそのカードになる）。
   * **基底が `never` なのはそのため。** ハンドラの `this` は反変なので、`CardActions<基底>`
   * と宣言するとサブクラスの `CardActions<自分>` が代入不可になる（TS2417）。`never` は
   * どの型にも代入できるので、どのカードの表もこれを満たす。
   */
  declare static ACTIONS: CardActions<never>;

  /** ボタンに反応する。`renderChatMessageHTML` から呼ばれる（配線は utils/chat-card.ts） */
  addListeners(html: HTMLElement): void {
    // staticメンバーはインスタンス側の型に出ないので constructor から引き直す
    const cls = this.constructor as typeof ChatCardModel;

    attachCardActions<ChatCardModel>(html, {
      ...cls.CARD,
      model: this,
      // 束ねられるのは `action.call(model, ...)` するインスタンス自身なので、
      // 実際の `this` はサブクラス。読み出す側で型を戻す
      actions: cls.ACTIONS as CardActions<ChatCardModel>,
    });
  }
}
