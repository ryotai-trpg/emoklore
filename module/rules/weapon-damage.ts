import type { DamageDie, RangeType } from "../config/attack-skills";

export type DamageFormulaParams = {
  /** 攻撃判定の成功数。振るダイスの数になる */
  successCount: number;
  /** 参照技能から引いたダメージのダイス面。遠隔攻撃はダイスを振らないので null */
  damageDie: DamageDie;
  /** 武器攻撃力。「2」のような固定値でも「1D6」のようなダイス式でもよい。空なら加算しない */
  attackPower: string;
  /**
   * 武器攻撃力に足す固定値。
   *
   * 近接戦闘の武器攻撃力は〈ストレングス〉技能レベルぶん増える。
   * 呼び出し側が resolveStrengthBonus の答えを渡す。
   */
  bonus?: number;
};

/**
 * ダメージを振れる成功数か。
 *
 * 攻撃が命中していなければダメージは発生しない。ダイスの数が成功数そのものなので、
 * 0以下だと式としても成り立たない。
 */
export function canRollDamage(successCount: number): boolean {
  return successCount >= 1;
}

/**
 * ダメージのロール式を組み立てる。
 *
 * ルールブックではダメージ式が武器ではなく技能の側に書かれている。
 * 〈＊格闘〉〈武術〉は【成功数】D3＋武器攻撃力、〈★奥義〉は【成功数】D6＋武器攻撃力、
 * 〈＊投擲〉〈★射撃〉はダイスを振らず【成功数】＋武器攻撃力となる。
 */
export function buildDamageFormula({
  successCount,
  damageDie,
  attackPower,
  bonus = 0,
}: DamageFormulaParams): string {
  if (!canRollDamage(successCount)) {
    throw new Error(`ダメージを振れる成功数ではない: ${successCount}`);
  }

  const dice = damageDie ? `${successCount}${damageDie}` : `${successCount}`;
  const power = attackPower ? ` + ${attackPower}` : "";
  const strength = bonus ? ` ${bonus > 0 ? "+" : "-"} ${Math.abs(bonus)}` : "";

  return `${dice}${power}${strength}`;
}

/**
 * 近接戦闘の武器攻撃力に乗る〈ストレングス〉加算。
 *
 * 技能一覧〈ストレングス〉付記のとおり加算されるのは近接戦闘だけで、
 * 遠隔（投擲・射撃）には乗らない。
 */
export function resolveStrengthBonus(rangeType: RangeType, strengthLevel: number): number {
  return rangeType === "melee" ? strengthLevel : 0;
}
