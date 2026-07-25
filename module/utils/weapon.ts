/**
 * 武器の表示用の整形。
 *
 * シート（`applications/`）とチャットカード（`chat/`）の両方から使うので、どちらにも
 * 寄せずここに置く。ルール計算は `rules/weapon-damage.ts`、カードの組み立ては
 * `chat/weapon-card.ts` が持つ。
 */

import {
  type AttackSkillConfig,
  attackSkills,
  type DamageDie,
  isAttackSkillKey,
  type RangeType,
} from "../config/attack-skills";

/**
 * 攻撃技能の定義を引く。未知のキーは近接の既定（〈＊格闘〉）に倒す。
 *
 * 未知のキーが来る経路は3つある。手書き・移行データ、CONFIG.EMOKLORE.attackSkills から
 * キーを消したモジュール、そして emoklore.preRollAttack で skill を差し替えるモジュール。
 * 倒し先はここだけが決める。引く側が個別に ?? で倒すと、同じ入力に対して base や
 * damageDie の既定が呼び出し元ごとに食い違う
 */
export const resolveAttackSkill = (skill: string): AttackSkillConfig =>
  isAttackSkillKey(skill) ? attackSkills[skill] : attackSkills.fight;

/** 間合いの表示名。「近接」「遠隔」 */
export const localizeRangeType = (rangeType: RangeType): string =>
  game.i18n.localize(`EMOKLORE.Item.weapon.RangeType.${rangeType}`);

/**
 * 参照技能の表示名。
 *
 * attackSkills の label は preLocalize の対象外（スキーマの choices と共有しているため）
 * なので、翻訳は引く側で行う。
 */
export const localizeAttackSkill = (skill: string): string =>
  game.i18n.localize(resolveAttackSkill(skill).label);

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
