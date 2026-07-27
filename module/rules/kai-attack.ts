import type { RollSpec } from "./types";
import { canRollDamage } from "./weapon-damage";

/**
 * 怪異の攻撃判定の内容を決める。
 *
 * 共鳴者・人間NPCの技能判定と違い、能力値＋技能から目標値を派生させない。シナリオが
 * `2DM≦7` の形でダイス数と判定値を直接与えるため（固有技能の判定値は能力値+レベルに
 * 限らない）、受け取った値をそのまま `RollSpec` に組む。修正の系統は持たない。
 */
export function buildKaiAttackSpec({
  diceCount,
  target,
}: {
  diceCount: number;
  target: number;
}): RollSpec {
  return {
    diceCount,
    target,
    successMod: 0,
    dmFormula: `${diceCount}DM≦${target}`,
  };
}

/**
 * ダメージ式の成功数プレースホルダ `@success` を実際の成功数に差し替える。
 *
 * 「成功数D3＋3」のような式を `@successd3+3` と書けるようにする器。本体の Roll に
 * `@success` をロールデータとして渡す手もあるが、本体の @参照は正規表現が
 * `@successd3` を1つの参照として食べてしまい `d3` を落とす。ここで文字列として先に
 * 差し替えれば `@successd3` → `3d3` とグルーが効くので、素直に振れる形になる。
 *
 * `1+1D6` のように成功数に依らない固定式は `@success` を含まないのでそのまま通る。
 */
export function substituteSuccess(formula: string, successCount: number): string {
  return formula.replace(/@success/gi, String(successCount));
}

/**
 * 怪異の攻撃で、ダメージを振れる段まで進んでいるか。
 *
 * 武器と違って事情が2つ増える。
 *
 * 1つは**ダメージ式が空の攻撃**。怪異の `attacks` は固有技能も兼ねる器なので、判定だけで
 * ダメージを持たないものが普通にある。
 *
 * もう1つは**判定なしの攻撃**で、こちらには「外れる」概念が無い。固定成功数は0も取れて
 * （スキーマの `min` が0）、`@success` を含まない固定ダメージ式と組み合わせられるため、
 * 命中の条件（成功数1以上）に掛けるとボタンが1つも出ないカードになる。
 *
 * **どちらの道でも成功数が決まっていることは要る。** カードは `judgeless` と
 * `successCount: null` の組を保存できてしまう（スキーマがその対を禁じられない）ので、
 * ここで見ておかないと `@success` の差し替えが `"nulld4+3"` を作る。
 */
export function canRollKaiDamage({
  judgeless,
  successCount,
  damageFormula,
}: {
  judgeless: boolean;
  successCount: number | null;
  damageFormula: string;
}): boolean {
  if (damageFormula === "") return false;
  if (successCount === null) return false;

  return judgeless || canRollDamage(successCount);
}
