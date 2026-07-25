import { attachCardActions, type CardActions } from "../../utils/chat-card";
import { EmokloreSystemDataModel } from "../system-model";

const { BooleanField, DocumentUUIDField, NumberField, StringField } = foundry.data.fields;

const defineResonanceOutcomeSchema = () => ({
  // 振った共鳴者。効果の適用先を #79 がここから辿る
  actorUuid: new DocumentUUIDField({ type: "Actor", nullable: true, initial: null }),
  name: new StringField({ required: true, blank: true, initial: "" }),

  successCount: new NumberField({ required: true, integer: true, initial: 0 }),

  // 上がった量と、上がったあとの値。上がらなかったら0と現在値
  rise: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
  before: new NumberField({ required: true, integer: true, initial: 1 }),
  after: new NumberField({ required: true, integer: true, initial: 1 }),

  // トリプル以上でハウリング発生。憑依判定では起きない
  howling: new BooleanField({ required: true, initial: false }),

  // 憑依判定で、成功数が【精神】以上に届いたか
  possessionReached: new BooleanField({ required: true, initial: false }),

  // 引く共鳴表／デッキを辿るための怪異。#79 が使う
  kaiUuid: new DocumentUUIDField({ type: "Actor", nullable: true, initial: null }),
});

/**
 * 共鳴判定・憑依判定のあと始末をチャットに残す。〈∞共鳴〉の変化とハウリングの発生。
 *
 * 判定そのもののロールとは別のメッセージにしてある。ロールは振った本人のもので、
 * こちらは「その結果どうなったか」の記録だから。要求カードに書き戻せないのと同じ理由で
 * （PLは作成者でないカードを更新できない）、結果は各自のメッセージとして並ぶ。
 *
 * ボタンはまだ無い。ハウリングの「表を引く／カードを引く」は #79 が `ACTIONS` に足す。
 */
export class ResonanceOutcomeModel extends EmokloreSystemDataModel {
  declare actorUuid: string | null;
  declare name: string;
  declare successCount: number;
  declare rise: number;
  declare before: number;
  declare after: number;
  declare howling: boolean;
  declare possessionReached: boolean;
  declare kaiUuid: string | null;

  /** カードのボタン。`data-action` の値と対応する。モジュールはここに足せる */
  static ACTIONS: CardActions<ResonanceOutcomeModel> = {};

  static override defineSchema() {
    return defineResonanceOutcomeSchema();
  }

  static override LOCALIZATION_PREFIXES = ["EMOKLORE.ChatMessage.resonanceOutcome"];

  /** ボタンに反応する。`renderChatMessageHTML` から呼ばれる（配線は utils/chat-card.ts） */
  addListeners(html: HTMLElement): void {
    attachCardActions(html, {
      root: ".em-resonance-outcome",
      model: this,
      actions: ResonanceOutcomeModel.ACTIONS,
      label: "共鳴結果カード",
      errorKey: "EMOKLORE.ChatMessage.resonanceOutcome.ActionFailed",
    });
  }
}
