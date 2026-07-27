import { canRollKaiDamage } from "../../rules/kai-attack";
import type { CardActions } from "../../utils/chat-card";
import { diceFormulaValidator } from "../kai";
import {
  AttackCardModel,
  type AttackProgress,
  type CardButtons,
  resolveCardButtons,
} from "./attack-card";
import type { CardIdentity } from "./card-model";

const { BooleanField, DocumentUUIDField, NumberField, StringField } = foundry.data.fields;

/** カードの描画・保存に要る状態。スキーマと同じ形 */
export type KaiAttackCardState = AttackProgress & {
  attackName: string;
  actorUuid: string | null;
  mpCost: number;
  judgeless: boolean;
  diceCount: number;
  target: number;
  damageFormula: string;
};

const defineKaiAttackCardSchema = () => {
  return {
    attackName: new StringField({ required: true, blank: true, initial: "" }),
    // ダメージ適用の委譲・参照のために持つ。カードの描画自体は下の焼き込みで足りる
    actorUuid: new DocumentUUIDField({ type: "Actor", nullable: true, initial: null }),
    mpCost: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
    judgeless: new BooleanField({ required: true, initial: false }),

    // 判定とダメージはカードのボタンから振るので、使用時点の攻撃の内容を焼き込む。
    // 怪異を消したり攻撃欄を編集したあとでも、そのカードは出したときの内容で振れる
    diceCount: new NumberField({ required: true, integer: true, min: 0, initial: 1 }),
    target: new NumberField({ required: true, integer: true, min: 0, initial: 7 }),
    damageFormula: new StringField({
      required: true,
      blank: true,
      initial: "",
      validate: diceFormulaValidator,
      validationError: "is not a valid dice formula",
    }),
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
  declare diceCount: number;
  declare target: number;
  declare damageFormula: string;

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

  /** ダメージを振れる条件が武器と違う。判定なしと空のダメージ式のぶん */
  override get buttons(): CardButtons {
    return resolveCardButtons(this, canRollKaiDamage(this));
  }
}
