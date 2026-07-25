import { postMessage } from "../chat/message";
import { buildWeaponCardMessageData } from "../chat/weapon-card";
import type {
  ArmorDataModel,
  HowlingDataModel,
  SkillDataModel,
  WeaponDataModel,
} from "../data/item-models";
import type { WeaponCardSource } from "../data/messages/weapon-card";
import type { EmokloreSystemDataModel } from "../data/system-model";
import { localizeRangeType } from "../utils/weapon";
import type { EmokloreActor } from "./actor";

export class EmokloreItem extends Item {
  // スキーマ由来のプロパティは本体JSDocの型に出ないため補強する
  declare system: EmokloreSystemDataModel;
  declare effects: foundry.utils.Collection<string, foundry.documents.ActiveEffect>;
  // ClientDocumentMixin 由来のメンバーも同様に型に出ない。
  // uuid / actor は本体側が getter なので、ここで宣言し直すことはできない
  declare name: string;
  declare img: string;
  declare type: string;
  declare getRollData: () => Record<string, unknown>;

  /**
   * 武器かどうか。真なら system を WeaponDataModel として読める。
   *
   * type は本体JSDocでは string 止まりで、system も種別ごとのデータモデルまでは
   * 絞られない。種別の判定と型の絞り込みを1つにまとめ、呼び出し側が
   * 「確認したうえで、さらに as で名乗り直す」形にならないようにする。
   */
  isWeapon(): this is EmokloreItem & { type: "weapon"; system: WeaponDataModel } {
    return this.type === "weapon";
  }

  /** 防具かどうか。真なら system を ArmorDataModel として読める */
  isArmor(): this is EmokloreItem & { type: "armor"; system: ArmorDataModel } {
    return this.type === "armor";
  }

  /**
   * カスタム技能かどうか。真なら system を SkillDataModel として読める。
   *
   * 判定の入口（シートの行・効果の適用先）はどれも `actor.items` から引いた
   * ドキュメントを受けるので、種別の確認はここに集約する。
   */
  isSkill(): this is EmokloreItem & { type: "skill"; system: SkillDataModel } {
    return this.type === "skill";
  }

  /**
   * ハウリング反応かどうか。真なら system を HowlingDataModel として読める。
   *
   * 効果タブは所持アイテムのうちこれだけを別区分に分けるので、絞り込みはここを通る。
   */
  isHowling(): this is EmokloreItem & { type: "howling"; system: HowlingDataModel } {
    return this.type === "howling";
  }

  /**
   * 武器を使い、チャットに武器カードを出す。
   *
   * 判定は振らない。カードのボタンから攻撃判定とダメージを順に振る形にしているので、
   * ここはカードを1枚置くだけの薄い層になる。
   */
  async use(): Promise<ChatMessage | undefined> {
    if (!this.isWeapon()) {
      throw new Error(`emoklore | 使用に対応していないアイテム種別: ${this.type}`);
    }
    // 本体の型は Actor 止まりなので、判定を持つ実装クラスとしてここで1回だけ絞る
    const actor = this.actor as EmokloreActor | null;
    if (!actor) {
      ui.notifications?.warn("EMOKLORE.ChatMessage.weapon.NoActor", { localize: true });
      return;
    }

    const system = this.system;
    // 武器やアクターを消したあとでもカードが読めるよう、表示に要る値は焼き込む
    const state: WeaponCardSource = {
      weaponName: this.name,
      weaponImg: this.img,
      skill: system.skill,
      attackPower: system.attackPower,
      rangeLabel: localizeRangeType(system.rangeType),
      successCount: null,
      damageTotal: null,
      itemUuid: this.uuid,
      actorUuid: actor.uuid,
    };

    // フックは完成したメッセージを書き換えられるので、組み立てと作成を分ける
    const messageData = await buildWeaponCardMessageData(state, ChatMessage.getSpeaker({ actor }));

    if (Hooks.call("emoklore.preUseWeapon", this, messageData) === false) return;

    const message = await postMessage(messageData);
    Hooks.callAll("emoklore.useWeapon", this, message);

    return message;
  }
}
