import type { CardActions } from "../../utils/chat-card";
import { type CardIdentity, ChatCardModel } from "./card-model";

const { BooleanField, DocumentUUIDField, NumberField, StringField } = foundry.data.fields;

/** カードに焼き込む結果の内容。スキーマと同じ形 */
export type ResonanceOutcomeState = {
  actorUuid: string | null;
  name: string;
  successCount: number;
  rise: number;
  before: number;
  after: number;
  howling: boolean;
  possessionReached: boolean;
  kaiUuid: string | null;
};

const defineResonanceOutcomeSchema = () => ({
  // 振った共鳴者。引いたハウリング反応の適用先をここから辿る
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

  // 引く共鳴表を辿るための怪異。「共鳴表を引く」ボタンがここから表に行き着く
  kaiUuid: new DocumentUUIDField({ type: "Actor", nullable: true, initial: null }),
});

/**
 * 共鳴判定・憑依判定のあと始末をチャットに残す。〈∞共鳴〉の変化とハウリングの発生。
 *
 * 判定そのもののロールとは別のメッセージにしてある。ロールは振った本人のもので、
 * こちらは「その結果どうなったか」の記録だから。要求カードに書き戻せないのと同じ理由で
 * （PLは作成者でないカードを更新できない）、結果は各自のメッセージとして並ぶ。
 *
 * ハウリングが起きたときだけ「共鳴表を引く」のボタンが出る。ハンドラは表を引いて
 * アイテムを作るので `applications/` 側にあり、init が `ACTIONS` へ登録する。
 */
export class ResonanceOutcomeModel extends ChatCardModel {
  declare actorUuid: string | null;
  declare name: string;
  declare successCount: number;
  declare rise: number;
  declare before: number;
  declare after: number;
  declare howling: boolean;
  declare possessionReached: boolean;
  declare kaiUuid: string | null;

  static override CARD: CardIdentity = {
    root: ".em-resonance-outcome",
    type: "resonanceOutcome",
  };

  /** カードのボタン。`data-action` の値と対応する。モジュールはここに足せる */
  static override ACTIONS: CardActions<ResonanceOutcomeModel> = {};

  static override defineSchema() {
    return defineResonanceOutcomeSchema();
  }
}
