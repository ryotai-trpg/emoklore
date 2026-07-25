import type { AttackSkillKey } from "../../config/attack-skills";
import { canRollDamage } from "../../rules/weapon-damage";
import type { CardActions } from "../../utils/chat-card";
import { ChatCardModel } from "./card-model";

const { DocumentUUIDField, NumberField, StringField } = foundry.data.fields;

/** カードの描画に要る状態。スキーマのうち、見せ方に効く分 */
export type WeaponCardState = {
  weaponName: string;
  weaponImg: string;
  skill: AttackSkillKey;
  attackPower: string;
  rangeLabel: string;
  successCount: number | null;
  damageTotal: number | null;
};

/** 保存する状態。描画には使わないがモジュール連携のために持つ参照を足したもの */
export type WeaponCardSource = WeaponCardState & {
  itemUuid: string | null;
  actorUuid: string | null;
};

/**
 * カードが載っている ChatMessage。
 *
 * `parent` は本体の型では DataModel 止まりで、ChatMessage のメンバーが出てこない。
 * 実際に使うものだけを交差型で補う（docs/code-design.md「本体の型が足りないとき」）。
 */
export type WeaponCardMessage = ChatMessage & {
  rolls: foundry.dice.Roll[];
  update: (data: Record<string, unknown>) => Promise<unknown>;
};

/** カードのどのボタンが出るか。押せるかどうかの判定にも同じものを使う */
export type CardButtons = {
  canRollAttack: boolean;
  canRollDamage: boolean;
  canApplyDamage: boolean;
};

/**
 * カードの進み具合からボタンの出し分けを決める。
 *
 * 描画とアクション側のガードで同じ条件が要る。別々に書くと、片方だけ直したときに
 * 「押せるのに何も起きない」「押せないはずが実行される」という形でずれる。
 */
export const resolveCardButtons = (
  state: Pick<WeaponCardState, "successCount" | "damageTotal">,
): CardButtons => ({
  canRollAttack: state.successCount === null,
  canRollDamage:
    state.successCount !== null && canRollDamage(state.successCount) && state.damageTotal === null,
  // 適用は何度でも押せるようにしておく。狙いを変えて続けて当てることがある
  canApplyDamage: state.damageTotal !== null,
});

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

    // まだ振っていなければ null。ボタンの出し分けはこの2つで決まる
    successCount: new NumberField({ required: true, integer: true, nullable: true, initial: null }),
    damageTotal: new NumberField({ required: true, integer: true, nullable: true, initial: null }),
  };
};

/**
 * 武器カードのChatMessage。
 *
 * 1枚のカードが育つ形にしている。攻撃判定もダメージも同じメッセージに追記していくので、
 * 状態（成功数・ダメージ）をメッセージ自身が持てるサブタイプが素直に噛み合う。
 *
 * `renderHTML` は定義しない。定義すると本体のメッセージ枠（アバター・発言者・時刻・削除）を
 * まるごと自前で描くことになる。`content` だけを自分で持ち、枠は本体に描かせる。
 * 本体は `content` に要素があれば `rolls` を自動描画しないので、ロールをメッセージに
 * 載せたまま、カード側で見出し付きに並べられる。
 *
 * **ボタンのハンドラは持たない。** 判定とダメージ適用を駆動するので `applications/` 側に
 * 置き、`emoklore.ts` の init が `ACTIONS` へ登録する（他のカードと同じ形）。
 */
export class WeaponCardModel extends ChatCardModel {
  declare weaponName: string;
  declare weaponImg: string;
  declare skill: AttackSkillKey;
  declare attackPower: string;
  declare rangeLabel: string;
  declare itemUuid: string | null;
  declare actorUuid: string | null;
  declare successCount: number | null;
  declare damageTotal: number | null;

  static override CARD = {
    root: ".em-weapon-card",
    label: "武器カード",
    errorKey: "EMOKLORE.ChatMessage.weapon.ActionFailed",
  };

  /** カードのボタン。`data-action` の値と対応する。モジュールはここに足せる */
  static override ACTIONS: CardActions<WeaponCardModel> = {};

  static override defineSchema() {
    return defineWeaponCardSchema();
  }

  static override LOCALIZATION_PREFIXES = ["EMOKLORE.ChatMessage.weapon"];

  /** カードが載っているメッセージ。parent の型が DataModel 止まりなのでここで1回だけ絞る */
  get message(): WeaponCardMessage {
    return this.parent as WeaponCardMessage;
  }

  get attackRoll(): foundry.dice.Roll | undefined {
    return this.message.rolls[0];
  }

  /** ボタンの出し分け。描画側と同じ判定を使う */
  get buttons(): CardButtons {
    return resolveCardButtons(this);
  }
}
