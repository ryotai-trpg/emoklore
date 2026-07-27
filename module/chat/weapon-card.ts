/**
 * 武器カードの組み立て。
 *
 * 1枚のカードが育つ形にしているので、作るときと書き足すときの両方でここを通る。
 * ルール計算は `rules/weapon-damage.ts`、ラベルの整形は `utils/weapon.ts` が持つ。
 */

import { systemPath } from "../constants";
import { type AttackRolls, flattenRolls } from "../data/messages/attack-card";
import type { CardMessage } from "../data/messages/card-model";
import {
  resolveWeaponCardButtons,
  type WeaponCardSource,
  type WeaponCardState,
} from "../data/messages/weapon-card";
import { localizeAttackSkill } from "../utils/weapon";
import { buildCardMessageData, updateCardMessage } from "./message";

const TEMPLATE = systemPath("templates/chat/weapon-card.hbs");

/**
 * 武器カードのHTMLを組み立てる。
 *
 * 状態をモデルからではなく引数で受けるのは、更新の直前に「これから保存する状態」で
 * 描く必要があるため。カードを最初に作る時点ではモデルがまだ存在しないという事情もある。
 */
async function renderWeaponCard(
  state: WeaponCardState,
  { attackRoll, damageRoll }: AttackRolls,
): Promise<string> {
  return foundry.applications.handlebars.renderTemplate(TEMPLATE, {
    ...state,
    ...resolveWeaponCardButtons(state),
    skillLabel: localizeAttackSkill(state.skill),
    attackHTML: attackRoll ? await attackRoll.render() : "",
    damageHTML: damageRoll ? await damageRoll.render() : "",
  });
}

/**
 * 武器を使ったときのメッセージを組み立てる。作成はしない。
 *
 * `emoklore.preUseWeapon` はここで出来たものを受け取り、書き換えられる。だから
 * 作成と分けてある（フックが見る時点で完成している必要がある）。まだ何も振って
 * いないのでロールは空で、ダイス音も鳴らさない。
 */
export async function buildWeaponCardMessageData(
  state: WeaponCardSource,
  speaker: ReturnType<typeof ChatMessage.getSpeaker>,
) {
  return buildCardMessageData({
    type: "weapon",
    system: state,
    content: await renderWeaponCard(state, {}),
    speaker,
  });
}

/** 振った結果をカードに書き戻して描き直す。当て方とダイス音は `chat/message.ts` が持つ */
export async function updateWeaponCard(
  message: CardMessage,
  system: WeaponCardState,
  rolls: AttackRolls,
): Promise<void> {
  await updateCardMessage(message, {
    content: await renderWeaponCard(system, rolls),
    rolls: flattenRolls(rolls),
    system,
  });
}
