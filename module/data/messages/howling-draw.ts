import { attachCardActions, type CardActions } from "../../utils/chat-card";
import { EmokloreSystemDataModel } from "../system-model";

const { DocumentUUIDField, HTMLField, StringField } = foundry.data.fields;

const defineHowlingDrawSchema = () => ({
  // 引いた共鳴者。効果の適用先で、押した人がここのOWNERでなければ適用は止まる
  actorUuid: new DocumentUUIDField({ type: "Actor", nullable: true, initial: null }),
  name: new StringField({ required: true, blank: true, initial: "" }),

  // どの怪異のどの表から引いたか。出典の記録で、描画には使わない
  kaiUuid: new DocumentUUIDField({ type: "Actor", nullable: true, initial: null }),
  tableUuid: new DocumentUUIDField({ type: "RollTable", nullable: true, initial: null }),

  // 反応そのもの。**アイテムや表を消したあとでもカードが読めるよう焼き込む**（武器カードと同じ）。
  // category は表示用に写した分類キーで、choices は付けない（text結果では空になる）
  reactionName: new StringField({ required: true, blank: true, initial: "" }),
  reactionImg: new StringField({ required: true, blank: true, initial: "" }),
  category: new StringField({ required: true, blank: true, initial: "" }),
  description: new HTMLField({ required: true, blank: true }),
  recoverySkills: new StringField({ required: true, blank: true, initial: "" }),
  recoveryNote: new StringField({ required: true, blank: true, initial: "" }),

  // 適用でアクターに作る反応アイテム。text結果や反応以外を指す結果では null
  itemUuid: new DocumentUUIDField({ type: "Item", nullable: true, initial: null }),
});

/**
 * 共鳴表から引いた結果のChatMessage。
 *
 * 判定・共鳴結果に続く3枚目のカードになる。**出したら変わらない** — 適用したかどうかを
 * カードへ書き戻さないのは、本体が作成者にしか OWNER を返さないため（`ChatMessage#getUserLevel`）
 * で、要求カードや生存リマインダと同じ扱い。いま何を受けているかは共鳴者の効果タブが持つ。
 *
 * ボタンのハンドラは持たない。アイテムの作成を駆動するので `applications/` 側に置き、
 * `emoklore.ts` の init が `ACTIONS` へ登録する（architecture.md 課題5 を繰り返さない）。
 */
export class HowlingDrawModel extends EmokloreSystemDataModel {
  declare actorUuid: string | null;
  declare name: string;
  declare kaiUuid: string | null;
  declare tableUuid: string | null;
  declare reactionName: string;
  declare reactionImg: string;
  declare category: string;
  declare description: string;
  declare recoverySkills: string;
  declare recoveryNote: string;
  declare itemUuid: string | null;

  /** カードのボタン。`data-action` の値と対応する。モジュールはここに足せる */
  static ACTIONS: CardActions<HowlingDrawModel> = {};

  static override defineSchema() {
    return defineHowlingDrawSchema();
  }

  static override LOCALIZATION_PREFIXES = ["EMOKLORE.ChatMessage.howlingDraw"];

  /** ボタンに反応する。`renderChatMessageHTML` から呼ばれる（配線は utils/chat-card.ts） */
  addListeners(html: HTMLElement): void {
    attachCardActions(html, {
      root: ".em-howling-draw",
      model: this,
      actions: HowlingDrawModel.ACTIONS,
      label: "ハウリング反応カード",
      errorKey: "EMOKLORE.ChatMessage.howlingDraw.ActionFailed",
    });
  }
}
