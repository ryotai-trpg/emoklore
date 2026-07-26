import type { EmokloreActor } from "../../documents/actor";
import type { CardActions } from "../../utils/chat-card";
import { type CardIdentity, ChatCardModel } from "./card-model";

const { ArrayField, DocumentUUIDField, NumberField, SchemaField, StringField } =
  foundry.data.fields;

/** リマインダ1体ぶん。アクターを消したあとも読めるよう名前を焼き込む */
export type SurvivalTarget = {
  actorUuid: string | null;
  name: string;
};

/** カードに焼き込む内容。スキーマと同じ形 */
export type SurvivalReminderState = {
  round: number;
  targets: SurvivalTarget[];
};

const defineSurvivalReminderSchema = () => {
  return {
    round: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
    targets: new ArrayField(
      new SchemaField({
        actorUuid: new DocumentUUIDField({ type: "Actor", nullable: true, initial: null }),
        name: new StringField({ required: true, blank: true, initial: "" }),
      }),
    ),
  };
};

/**
 * ラウンド終了時、【心肺停止】のキャラクターに〈＊生存〉判定を促すリマインダのChatMessage。
 *
 * 表示と判定ショートカットまで。判定の強制や【死亡】の自動付与はしない
 * （docs/roadmap.md「実装しないこと: 高度な自動化」）。damage-applied と同じ型付きサブタイプに
 * して、`renderChatMessageHTML` の汎用配線（system.addListeners）に乗せる。
 */
export class SurvivalReminderModel extends ChatCardModel {
  declare round: number;
  declare targets: SurvivalTarget[];

  static override CARD: CardIdentity = {
    root: ".em-survival-reminder",
    type: "survivalReminder",
  };

  /** ボタン。`data-action` の値と対応する。モジュールはここに足せる */
  static override ACTIONS: CardActions<SurvivalReminderModel>;

  static override defineSchema() {
    return defineSurvivalReminderSchema();
  }

  /**
   * 〈生存〉判定を振るショートカット。振るだけで、成否の反映（【死亡】付与など）はしない。
   *
   * 判定を振れる権限が無ければ本体の判定側で弾かれる。ダメージ適用のようなGM委譲はしない。
   */
  async rollSurvival(button: HTMLElement): Promise<void> {
    const { actorUuid } = button.dataset;
    if (!actorUuid) return;

    const actor = (await foundry.utils.fromUuid(actorUuid)) as EmokloreActor | null;
    if (!actor) {
      ui.notifications?.warn("EMOKLORE.ChatMessage.Common.ActorMissing", {
        localize: true,
      });
      return;
    }

    // 〈＊生存〉は基本技能 survival。〈耐久〉〈根性〉での代用は各自の判断に任せる
    await actor.rollSkill({ kind: "base", key: "survival" });
  }
}

// クラス本体の静的初期化子から prototype を引くと定義順に依存するので、外で組み立てる
SurvivalReminderModel.ACTIONS = {
  rollSurvival: SurvivalReminderModel.prototype.rollSurvival,
};
