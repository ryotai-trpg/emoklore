/**
 * 武器カードの組み立て。
 *
 * 1枚のカードが育つ形にしているので、作るときと書き足すときの両方でここを通る。
 * ルール計算は `rules/weapon-damage.ts`、ラベルの整形は `utils/weapon.ts` が持つ。
 */

import { systemPath } from "../constants";
import {
  resolveCardButtons,
  type WeaponCardMessage,
  type WeaponCardSource,
  type WeaponCardState,
} from "../data/messages/weapon-card";
import { localizeAttackSkill } from "../utils/weapon";
import { buildCardMessageData } from "./message";

const TEMPLATE = systemPath("templates/chat/weapon-card.hbs");

/**
 * 武器カードのHTMLを組み立てる。
 *
 * 状態をモデルからではなく引数で受けるのは、更新の直前に「これから保存する状態」で
 * 描く必要があるため。カードを最初に作る時点ではモデルがまだ存在しないという事情もある。
 */
export async function renderWeaponCard(
  state: WeaponCardState,
  rolls: foundry.dice.Roll[],
): Promise<string> {
  const [attackRoll, damageRoll] = rolls;

  return foundry.applications.handlebars.renderTemplate(TEMPLATE, {
    ...state,
    ...resolveCardButtons(state),
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
    content: await renderWeaponCard(state, []),
    speaker,
  });
}

/**
 * 振った結果をカードに書き戻して描き直す。
 *
 * `content` を毎回組み直すのは、ボタンの出し分けと結果の表示が状態と一緒に変わるため。
 * 作成時と違って更新では `sound` が鳴らないので、ダイス音はここで明示的に鳴らす。
 */
export async function updateWeaponCard(
  message: WeaponCardMessage,
  system: WeaponCardState,
  rolls: foundry.dice.Roll[],
): Promise<void> {
  const content = await renderWeaponCard(system, rolls);

  await message.update({ content, rolls, system });

  // モジュールが CONFIG.sounds を空にしている場合があるので、あるときだけ鳴らす
  const sound = CONFIG.sounds.dice;
  if (sound) foundry.audio.AudioHelper.play({ src: sound }, true);
}
