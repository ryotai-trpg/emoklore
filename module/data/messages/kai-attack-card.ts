import { EmokloreSystemDataModel } from "../system-model";

const { BooleanField, DocumentUUIDField, NumberField, StringField } = foundry.data.fields;

/** カードの1ボタンぶんの処理。押した瞬間に this がモデルに束縛される */
type KaiCardAction = (this: KaiAttackCardModel) => Promise<void>;

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
  static ACTIONS: Record<string, KaiCardAction> = {};

  static override defineSchema() {
    return defineKaiAttackCardSchema();
  }

  static override LOCALIZATION_PREFIXES = ["EMOKLORE.ChatMessage.kaiAttack"];

  /**
   * カードのボタンに反応する。`renderChatMessageHTML` から呼ばれる（武器カードと同じ配線）。
   */
  addListeners(html: HTMLElement): void {
    const card = html.querySelector(".em-kai-attack-card");
    if (!card) return;

    card.addEventListener("click", (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>("[data-action]");
      const actionName = target?.dataset.action;
      if (!target || !actionName) return;

      const action = KaiAttackCardModel.ACTIONS[actionName];
      if (!action) return;

      // 連打で二重に適用させない。処理中はボタンを落とし、成否によらず必ず戻す
      const button = target instanceof HTMLButtonElement ? target : null;
      if (button) button.disabled = true;

      action
        .call(this)
        .catch((error: unknown) => {
          console.error("emoklore | 怪異の攻撃カードの操作に失敗しました", error);
          ui.notifications?.error("EMOKLORE.ChatMessage.kaiAttack.ActionFailed", {
            localize: true,
          });
        })
        .finally(() => {
          if (button) button.disabled = false;
        });
    });
  }
}
