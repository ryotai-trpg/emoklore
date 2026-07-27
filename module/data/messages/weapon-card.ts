import type { AttackSkillKey } from "../../config/attack-skills";
import type { CardActions } from "../../utils/chat-card";
import { AttackCardModel, type AttackProgress } from "./attack-card";
import type { CardIdentity } from "./card-model";

const { DocumentUUIDField, StringField } = foundry.data.fields;

/** カードの描画に要る状態。スキーマのうち、見せ方に効く分 */
export type WeaponCardState = AttackProgress & {
  weaponName: string;
  weaponImg: string;
  skill: AttackSkillKey;
  attackPower: string;
  rangeLabel: string;
};

/** 保存する状態。描画には使わないがモジュール連携のために持つ参照を足したもの */
export type WeaponCardSource = WeaponCardState & {
  itemUuid: string | null;
  actorUuid: string | null;
};

const defineWeaponCardSchema = () => {
  return {
    // 表示と再ロールに要る値は使用時点で焼き込む。武器やアクターを消したあとでも
    // 過去のカードが読めて、ダメージも振り直せるようにするため
    weaponName: new StringField({ required: true, blank: true, initial: "" }),
    weaponImg: new StringField({ required: true, blank: true, initial: "" }),
    skill: new StringField({ required: true, blank: false, initial: "fight" }),
    attackPower: new StringField({ required: true, blank: true, initial: "" }),
    rangeLabel: new StringField({ required: true, blank: true, initial: "" }),

    // 参照はモジュール連携のために持つ。カードの描画自体は上の焼き込みだけで足りる
    itemUuid: new DocumentUUIDField({ type: "Item", nullable: true, initial: null }),
    actorUuid: new DocumentUUIDField({ type: "Actor", nullable: true, initial: null }),
  };
};

/**
 * 武器カードのChatMessage。
 *
 * 1枚のカードが育つ形と、その進み具合から決まるボタンの出し分けは `AttackCardModel` が持つ。
 * ここに残るのは武器に固有の焼き込みだけになる。
 *
 * `renderHTML` は定義しない。定義すると本体のメッセージ枠（アバター・発言者・時刻・削除）を
 * まるごと自前で描くことになる。`content` だけを自分で持ち、枠は本体に描かせる。
 * 本体は `content` に要素があれば `rolls` を自動描画しないので、ロールをメッセージに
 * 載せたまま、カード側で見出し付きに並べられる。
 *
 * **ボタンのハンドラは持たない。** 判定とダメージ適用を駆動するので `applications/` 側に
 * 置き、`emoklore.ts` の init が `ACTIONS` へ登録する（他のカードと同じ形）。
 */
export class WeaponCardModel extends AttackCardModel {
  declare weaponName: string;
  declare weaponImg: string;
  declare skill: AttackSkillKey;
  declare attackPower: string;
  declare rangeLabel: string;
  declare itemUuid: string | null;
  declare actorUuid: string | null;

  static override CARD: CardIdentity = {
    root: ".em-weapon-card",
    type: "weapon",
  };

  /** カードのボタン。`data-action` の値と対応する。モジュールはここに足せる */
  static override ACTIONS: CardActions<WeaponCardModel> = {};

  static override defineSchema() {
    return { ...super.defineSchema(), ...defineWeaponCardSchema() };
  }
}
