import type { CardActions } from "../../utils/chat-card";
import { AttackCardModel, type AttackProgress } from "./attack-card";
import type { CardIdentity } from "./card-model";

const { BooleanField, DocumentUUIDField, NumberField, StringField } = foundry.data.fields;

/** カードの描画・保存に要る状態。スキーマと同じ形 */
export type KaiAttackCardState = AttackProgress & {
  attackName: string;
  actorUuid: string | null;
  mpCost: number;
  judgeless: boolean;
};

const defineKaiAttackCardSchema = () => {
  return {
    attackName: new StringField({ required: true, blank: true, initial: "" }),
    // ダメージ適用の委譲・参照のために持つ。カードの描画自体は下の焼き込みで足りる
    actorUuid: new DocumentUUIDField({ type: "Actor", nullable: true, initial: null }),
    mpCost: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
    judgeless: new BooleanField({ required: true, initial: false }),
  };
};

/**
 * 怪異の攻撃カードのChatMessage。
 *
 * 1枚のカードが育つ形と、進み具合から決まるボタンの出し分けは `AttackCardModel` が持つ。
 * ここに残るのは怪異の攻撃に固有の焼き込みだけになる。
 *
 * ボタンのハンドラは `data/` に置かず、`applications/` 側が持つものを `emoklore.ts` の
 * init が `ACTIONS` へ登録する（どのカードも同じ形）。
 */
export class KaiAttackCardModel extends AttackCardModel {
  declare attackName: string;
  declare actorUuid: string | null;
  declare mpCost: number;
  declare judgeless: boolean;

  static override CARD: CardIdentity = {
    root: ".em-kai-attack-card",
    type: "kaiAttack",
  };

  /** カードのボタン。`data-action` の値と対応する。ハンドラは applications/ 側から登録する */
  static override ACTIONS: CardActions<KaiAttackCardModel> = {};

  static override defineSchema() {
    return { ...super.defineSchema(), ...defineKaiAttackCardSchema() };
  }

  /** 判定なしの攻撃は判定を振らないので、`message.rolls` の先頭がダメージになる */
  protected override get hasAttackRoll(): boolean {
    return !this.judgeless;
  }
}
