import type { EmokloreActor } from "../../documents/actor";
import { EmokloreSystemDataModel } from "../system-model";

const { ArrayField, DocumentUUIDField, NumberField, SchemaField, StringField } =
  foundry.data.fields;

/** 案内のボタン1つぶんの処理。押した要素の dataset を読むので、要素ごと受け取る */
type NoticeAction = (this: DamageAppliedModel, button: HTMLElement) => Promise<void>;

/** どのリソースの結果か。行の書式と境界の案内の出し分けに使う */
export type ResourceKind = "hp" | "mp";

/** 対象1体ぶんの適用結果。境界の判定に要る前後の値を焼き込む */
export type AppliedTarget = {
  actorUuid: string | null;
  name: string;
  before: number;
  after: number;
  /** 軽減に使った防具の値。行の内訳に出す */
  armor: number;
};

const defineDamageAppliedSchema = () => {
  return {
    resource: new StringField({ required: true, blank: false, initial: "hp" }),
    reduction: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
    // アクターを消したあともメッセージが読めるよう、名前と値は焼き込む。
    // uuid は付与ボタンの参照用で、引けなくなっていたら押したときに警告する
    targets: new ArrayField(
      new SchemaField({
        actorUuid: new DocumentUUIDField({ type: "Actor", nullable: true, initial: null }),
        name: new StringField({ required: true, blank: true, initial: "" }),
        before: new NumberField({ required: true, integer: true, initial: 0 }),
        after: new NumberField({ required: true, integer: true, initial: 0 }),
        armor: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      }),
    ),
  };
};

/**
 * ダメージ適用（とMP減少）の結果を知らせるChatMessage。
 *
 * 以前は subtype なしの content だけのメッセージだったが、境界の案内に
 * ステータス付与のボタンを載せるにはリスナの配線先（system.addListeners）が要る。
 * 武器カードと同じ形のサブタイプにして、`renderChatMessageHTML` の汎用配線に乗せる。
 */
export class DamageAppliedModel extends EmokloreSystemDataModel {
  declare resource: ResourceKind;
  declare reduction: number;
  declare targets: AppliedTarget[];

  /** 案内のボタン。`data-action` の値と対応する。モジュールはここに足せる */
  static ACTIONS: Record<string, NoticeAction>;

  static override defineSchema() {
    return defineDamageAppliedSchema();
  }

  static override LOCALIZATION_PREFIXES = ["EMOKLORE.ChatMessage.damageApplied"];

  /**
   * 境界の案内から状態を付与する。付与だけで、外すのはトークンのHUDから。
   *
   * 権限が無ければ付与できない（ActiveEffect の作成をサーバが検査する）。
   * ダメージ適用のようなGM委譲はせず警告に留める。押すのはほぼDLで、
   * 必要になったら documents/queries.ts にクエリを1種足せば委譲できる。
   */
  async applyStatus(button: HTMLElement): Promise<void> {
    const { statusId, actorUuid } = button.dataset;
    if (!statusId || !actorUuid) return;

    const actor = (await foundry.utils.fromUuid(actorUuid)) as EmokloreActor | null;
    if (!actor) {
      ui.notifications?.warn("EMOKLORE.ChatMessage.damageApplied.ActorMissing", {
        localize: true,
      });
      return;
    }
    if (!actor.isOwner) {
      ui.notifications?.warn("EMOKLORE.ChatMessage.damageApplied.NoPermission", {
        localize: true,
      });
      return;
    }

    await actor.toggleStatusEffect(statusId, { active: true });

    // カードの見た目は変わらないので、付いたことだけ通知で返す
    ui.notifications?.info(
      game.i18n.localize("EMOKLORE.ChatMessage.damageApplied.StatusApplied", {
        name: actor.name,
        status: game.i18n.localize(CONFIG.statusEffects[statusId]?.name ?? ""),
      }),
    );
  }

  /**
   * 案内のボタンに反応する。`renderChatMessageHTML` から呼ばれる（武器カードと同じ配線）。
   *
   * 武器カードの ACTIONS と違ってボタン要素を渡すのは、1枚に対象ぶんのボタンが並び、
   * どの対象・どの状態かを押した要素の dataset からしか特定できないため。
   */
  addListeners(html: HTMLElement): void {
    const root = html.querySelector(".em-damage-applied");
    if (!root) return;

    root.addEventListener("click", (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>("[data-action]");
      const actionName = target?.dataset.action;
      if (!target || !actionName) return;

      const action = DamageAppliedModel.ACTIONS[actionName];
      if (!action) return;

      // 連打で二重に付けさせない。処理中はボタンを落とし、成否によらず必ず戻す
      const button = target instanceof HTMLButtonElement ? target : null;
      if (button) button.disabled = true;

      action
        .call(this, target)
        .catch((error: unknown) => {
          console.error("emoklore | 境界の案内の操作に失敗しました", error);
          ui.notifications?.error("EMOKLORE.ChatMessage.damageApplied.ActionFailed", {
            localize: true,
          });
        })
        .finally(() => {
          if (button) button.disabled = false;
        });
    });
  }
}

// クラス本体の静的初期化子から prototype を引くと定義順に依存するので、外で組み立てる
DamageAppliedModel.ACTIONS = {
  applyStatus: DamageAppliedModel.prototype.applyStatus,
};
