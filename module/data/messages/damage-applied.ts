import type { EmokloreActor } from "../../documents/actor";
import type { CardActions } from "../../utils/chat-card";
import { type CardIdentity, ChatCardModel } from "./card-model";

const { ArrayField, DocumentUUIDField, NumberField, SchemaField, StringField } =
  foundry.data.fields;

/** どのリソースの結果か。行の書式と境界の案内の出し分けに使う */
export type ResourceKind = "hp" | "mp";

/**
 * 対象1体ぶんの適用結果。境界の判定に要る前後の値を焼き込む。
 *
 * `applyDamageToTargets`（GMへの委譲を含む）が返すのもこの形。適用した結果と
 * カードに載る行は同じものなので、型を2つ持たない。
 */
export type AppliedTarget = {
  actorUuid: string | null;
  name: string;
  before: number;
  after: number;
  /** 軽減に使った防具の値。行の内訳に出す */
  armor: number;
};

/** カードに焼き込む内容。スキーマと同じ形 */
export type DamageAppliedState = {
  resource: ResourceKind;
  reduction: number;
  targets: AppliedTarget[];
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
export class DamageAppliedModel extends ChatCardModel {
  declare resource: ResourceKind;
  declare reduction: number;
  declare targets: AppliedTarget[];

  static override CARD: CardIdentity = {
    root: ".em-damage-applied",
    type: "damageApplied",
  };

  /** 案内のボタン。`data-action` の値と対応する。モジュールはここに足せる */
  static override ACTIONS: CardActions<DamageAppliedModel>;

  static override defineSchema() {
    return defineDamageAppliedSchema();
  }

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
      ui.notifications?.warn("EMOKLORE.ChatMessage.Common.ActorMissing", {
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
    ui.notifications?.info("EMOKLORE.ChatMessage.damageApplied.StatusApplied", {
      format: {
        name: actor.name,
        status: game.i18n.localize(CONFIG.statusEffects[statusId]?.name ?? ""),
      },
    });
  }
}

// クラス本体の静的初期化子から prototype を引くと定義順に依存するので、外で組み立てる
DamageAppliedModel.ACTIONS = {
  applyStatus: DamageAppliedModel.prototype.applyStatus,
};
