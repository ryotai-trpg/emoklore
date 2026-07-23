import { EmokloreSystemDataModel } from "../system-model";

const { ArrayField, DocumentUUIDField, NumberField, SchemaField, StringField } =
  foundry.data.fields;

/** どのリソースの結果か。行の書式と境界の案内の出し分けに使う */
export type ResourceKind = "hp" | "mp";

/** 対象1体ぶんの適用結果。境界の判定に要る前後の値を焼き込む */
export type AppliedTarget = {
  actorUuid: string | null;
  name: string;
  before: number;
  after: number;
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

  static override defineSchema() {
    return defineDamageAppliedSchema();
  }

  static override LOCALIZATION_PREFIXES = ["EMOKLORE.ChatMessage.damageApplied"];
}
