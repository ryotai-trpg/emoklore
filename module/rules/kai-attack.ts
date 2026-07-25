import type { RollSpec } from "./types";

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
