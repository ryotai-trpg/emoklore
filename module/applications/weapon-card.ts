/**
 * 武器カードのうち、武器に固有のボタンのハンドラ。
 *
 * 判定を駆動するので `data/` には置かず、`emoklore.ts` の init から
 * `WeaponCardModel.ACTIONS` に登録する。`data/` から `documents/` への逆依存を作らない
 * ためで、他のカードと同じ形。ダメージ適用は怪異カードと共通なので `attack-card.ts` にある。
 */

import { updateWeaponCard } from "../chat/weapon-card";
import { resolveSkillRef } from "../data/character-like";
import type { AttackRolls } from "../data/messages/attack-card";
import type { WeaponCardModel, WeaponCardState } from "../data/messages/weapon-card";
import type { EmokloreActor } from "../documents/actor";
import { buildDamageFormula, resolveStrengthBonus } from "../rules/weapon-damage";
import { resolveAttackSkill } from "../utils/weapon";

/**
 * 攻撃判定を振り、同じカードに書き足す。
 *
 * 攻撃判定は技能判定そのものなので、アクター側の組み立てをそのまま借りる。
 */
export async function rollAttack(this: WeaponCardModel): Promise<void> {
  if (!this.buttons.canRollAttack) return;

  const actor = await resolveActor(this);
  if (!actor) {
    ui.notifications?.warn("EMOKLORE.ChatMessage.weapon.ActorMissing", { localize: true });
    return;
  }

  // base は skill から決まるので config に載せない。両方を載せると、skill だけを
  // 差し替えるフックが「通常技能のキーに base: true」のような対を作れてしまう
  const config = { skill: this.skill };
  if (Hooks.call("emoklore.preRollAttack", this.message, config) === false) return;

  // skill はカードに焼き込んだ保存データで、フックで差し替えられてもいる。
  // 宣言した型（AttackSkillKey）を裏切りうるので、判定に渡す前に確かめる。
  // base を引くのはフックの後。先に引くと差し替え前の技能の答えを使うことになる
  const ref = resolveSkillRef(config.skill, { base: resolveAttackSkill(config.skill).base });
  if (!ref) {
    ui.notifications?.warn("EMOKLORE.ChatMessage.weapon.UnknownSkill", { localize: true });
    return;
  }

  const { roll } = await actor.buildSkillRoll(ref);
  const rolls = { attackRoll: roll };
  await applyRoll(this, rolls, { successCount: roll.successCount });

  Hooks.callAll("emoklore.rollAttack", this.message, roll);
}

/** ダメージを振り、同じカードに書き足す */
export async function rollDamage(this: WeaponCardModel): Promise<void> {
  if (!this.buttons.canRollDamage) return;

  // アクターが消えたカードでもダメージは振り直せる。そのときは〈ストレングス〉加算なし
  const actor = await resolveActor(this);
  const { damageDie, rangeType } = resolveAttackSkill(this.skill);
  const config = {
    // canRollDamage が成功数の非nullを保証している
    successCount: this.successCount as number,
    damageDie,
    attackPower: this.attackPower,
    // 〈ストレングス〉加算は能力値＋技能を持つ種別だけ。怪異（技能なし）や消えたアクターは0
    bonus: resolveStrengthBonus(
      rangeType,
      actor?.isCharacterLike() ? actor.system.skills.strength.level : 0,
    ),
  };
  if (Hooks.call("emoklore.preRollDamage", this.message, config) === false) return;

  const roll = new foundry.dice.Roll(buildDamageFormula(config));
  await roll.evaluate();

  const rolls = { attackRoll: this.attackRoll, damageRoll: roll };
  await applyRoll(this, rolls, { damageTotal: roll.total ?? 0 });

  Hooks.callAll("emoklore.rollDamage", this.message, roll);
}

/** ロールと状態をカードに書き戻す。描き直しとダイス音は chat/ 側が持つ */
async function applyRoll(
  card: WeaponCardModel,
  rolls: AttackRolls,
  changes: Partial<WeaponCardState>,
): Promise<void> {
  const system = { ...card.toObject(), ...changes } as WeaponCardState;

  await updateWeaponCard(card.message, system, rolls);
}

async function resolveActor(card: WeaponCardModel): Promise<EmokloreActor | undefined> {
  if (!card.actorUuid) return undefined;

  return ((await foundry.utils.fromUuid(card.actorUuid)) as EmokloreActor | null) ?? undefined;
}
