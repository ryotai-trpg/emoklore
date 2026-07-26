import type { HowlingCategory } from "../../config/howling-categories";
import type { CardActions } from "../../utils/chat-card";
import { type CardIdentity, ChatCardModel } from "./card-model";

const { DocumentUUIDField, HTMLField, StringField } = foundry.data.fields;

/**
 * カードに焼き込む内容。スキーマと同じ形。
 *
 * `category` を絞ってあるのはカードを**作るとき**の形だから。読み出す側（モデルの
 * `declare`）が素の `string` なのは、text結果では空になり、保存データが型を裏切りうるため。
 */
export type HowlingDrawState = {
  actorUuid: string | null;
  name: string;
  kaiUuid: string | null;
  tableUuid: string | null;
  reactionName: string;
  reactionImg: string;
  category: HowlingCategory | "";
  description: string;
  /** 回復判定に使う技能の並び。「＊自我／心理」。判定で回復しないなら空文字 */
  recoverySkills: string;
  recoveryNote: string;
  itemUuid: string | null;
};

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
export class HowlingDrawModel extends ChatCardModel {
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

  static override CARD: CardIdentity = {
    root: ".em-howling-draw",
    type: "howlingDraw",
  };

  /** カードのボタン。`data-action` の値と対応する。モジュールはここに足せる */
  static override ACTIONS: CardActions<HowlingDrawModel> = {};

  static override defineSchema() {
    return defineHowlingDrawSchema();
  }
}
