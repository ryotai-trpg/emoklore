/**
 * 武器の表示用の整形と、武器カードの組み立て。
 *
 * シート（applications）とチャットカード（data/messages・documents）の両方から使うので、
 * どちらにも寄せずここに置く。ルール計算は module/rules/weapon-damage.ts が持つ。
 */

import {
  type AttackSkillKey,
  attackSkills,
  type DamageDie,
  type RangeType,
} from "../config/attack-skills";
import { systemPath } from "../constants";
import { canRollDamage } from "../rules/weapon-damage";

const CARD_TEMPLATE = systemPath("templates/chat/weapon-card.hbs");

/** 間合いの表示名。「近接」「遠隔」 */
export const localizeRangeType = (rangeType: RangeType): string =>
  game.i18n.localize(`EMOKLORE.Item.weapon.RangeType.${rangeType}`);

/**
 * 武器の射程の表示。
 *
 * ルールブックに距離の規定がなく、近接武器は射程欄そのものを使わない。
 * 遠隔武器でも未記入なら距離を書きようがないので、どちらも間合いの表示名に倒す。
 */
export const formatRangeLabel = (rangeType: RangeType, range: string): string =>
  rangeType === "ranged" && range ? range : localizeRangeType(rangeType);

/**
 * 武器のダメージ式を人が読む形にする。「【成功数】D3＋1D3」など。
 *
 * 実際に振る式を組み立てるのは rules/weapon-damage.ts の役目で、これは見せ方だけを持つ。
 * 遠隔攻撃はダイスを振らず成功数がそのままダメージになるので、ダイス部分が消える。
 */
export const formatDamagePreview = (damageDie: DamageDie, attackPower: string): string => {
  const successes = game.i18n.localize("EMOKLORE.Item.weapon.SuccessCount");
  const dice = damageDie ? `${successes}${damageDie.toUpperCase()}` : successes;

  // 前後に空白を入れない。一覧の列で「＋」の前後が折り返し候補になり、式が途中で割れる
  return attackPower ? `${dice}＋${attackPower}` : dice;
};

/** カードの描画に要る状態。保存されるスキーマと同じ形 */
export type WeaponCardState = {
  weaponName: string;
  weaponImg: string;
  skill: AttackSkillKey;
  attackPower: string;
  rangeLabel: string;
  successCount: number | null;
  damageTotal: number | null;
};

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

  return foundry.applications.handlebars.renderTemplate(CARD_TEMPLATE, {
    ...state,
    skillLabel: game.i18n.localize(attackSkills[state.skill]?.label ?? ""),
    attackHTML: attackRoll ? await attackRoll.render() : "",
    damageHTML: damageRoll ? await damageRoll.render() : "",
    canRollAttack: state.successCount === null,
    canRollDamage:
      state.successCount !== null &&
      canRollDamage(state.successCount) &&
      state.damageTotal === null,
  });
}
