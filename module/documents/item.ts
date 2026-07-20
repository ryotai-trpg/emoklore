import type { WeaponDataModel } from "../data/item-models";
import type { EmokloreSystemDataModel } from "../data/system-model";
import { localizeRangeType, renderWeaponCard, type WeaponCardState } from "../utils/weapon";
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
  declare isOwner: boolean;
  declare getRollData: () => Record<string, unknown>;

  /**
   * 武器を使い、チャットに武器カードを出す。
   *
   * 判定は振らない。カードのボタンから攻撃判定とダメージを順に振る形にしているので、
   * ここはカードを1枚置くだけの薄い層になる。
   */
  async use(): Promise<ChatMessage | undefined> {
    if (this.type !== "weapon") {
      throw new Error(`emoklore | 使用に対応していないアイテム種別: ${this.type}`);
    }
    // 本体の型は Actor 止まりなので、判定を持つ実装クラスとしてここで1回だけ絞る
    const actor = this.actor as EmokloreActor | null;
    if (!actor) {
      ui.notifications?.warn("EMOKLORE.ChatMessage.weapon.NoActor", { localize: true });
      return;
    }

    const system = this.system as WeaponDataModel;
    // 武器やアクターを消したあとでもカードが読めるよう、表示に要る値は焼き込む
    const state: WeaponCardState & { itemUuid: string | null; actorUuid: string | null } = {
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

    const messageData = {
      type: "weapon",
      system: state,
      content: await renderWeaponCard(state, []),
      speaker: ChatMessage.getSpeaker({ actor }),
      flags: { core: { canPopout: true } },
    };

    if (Hooks.call("emoklore.preUseWeapon", this, messageData) === false) return;

    const message = (await ChatMessage.create(messageData)) as ChatMessage | undefined;
    Hooks.callAll("emoklore.useWeapon", this, message);

    return message;
  }
}
