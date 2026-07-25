import { attachCardActions, type CardActions } from "../../utils/chat-card";
import { EmokloreSystemDataModel } from "../system-model";

const { BooleanField, DocumentUUIDField, NumberField, StringField } = foundry.data.fields;

const defineKaiAttackCardSchema = () => {
  return {
    attackName: new StringField({ required: true, blank: true, initial: "" }),
    // ダメージ適用の委譲・参照のために持つ。カードの描画自体は下の焼き込みで足りる
    actorUuid: new DocumentUUIDField({ type: "Actor", nullable: true, initial: null }),
    mpCost: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
    judgeless: new BooleanField({ required: true, initial: false }),
    // 判定の成功数。judgeless のときは固定成功数が入る
    successCount: new NumberField({ required: true, integer: true, nullable: true, initial: null }),
    damageTotal: new NumberField({ required: true, integer: true, nullable: true, initial: null }),
  };
};

/**
 * 怪異の攻撃カードのChatMessage。
 *
 * 武器カードと違い育たない（判定とダメージを一度に振って1枚に出す）ので、状態は結果だけ持つ。
 * ボタンのハンドラ（ダメージ適用）は `data/` に置かず、`applications/` 側が持つものを
 * `emoklore.ts` の init が `ACTIONS` へ登録する。武器カードが `data/` でオーケストレータ化
 * している既知の課題（architecture.md 課題5）を、怪異カードでは繰り返さない。
 */
export class KaiAttackCardModel extends EmokloreSystemDataModel {
  declare attackName: string;
  declare actorUuid: string | null;
  declare mpCost: number;
  declare judgeless: boolean;
  declare successCount: number | null;
  declare damageTotal: number | null;

  /** カードのボタン。`data-action` の値と対応する。ハンドラは applications/ 側から登録する */
  static ACTIONS: CardActions<KaiAttackCardModel> = {};

  static override defineSchema() {
    return defineKaiAttackCardSchema();
  }

  static override LOCALIZATION_PREFIXES = ["EMOKLORE.ChatMessage.kaiAttack"];

  /** ボタンに反応する。`renderChatMessageHTML` から呼ばれる（配線は utils/chat-card.ts） */
  addListeners(html: HTMLElement): void {
    attachCardActions(html, {
      root: ".em-kai-attack-card",
      model: this,
      actions: KaiAttackCardModel.ACTIONS,
      label: "怪異の攻撃カード",
      errorKey: "EMOKLORE.ChatMessage.kaiAttack.ActionFailed",
    });
  }
}
