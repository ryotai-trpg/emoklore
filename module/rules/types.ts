/** 技能・能力値・技能グループが共通で持つ修正値の組 */
export type ModifierSet = {
  bonus: number;
  success: number;
  target: number;
};

/**
 * 何も修正しない組。
 *
 * どの技能グループにも属さないカスタム技能のように、修正の出どころが存在しない
 * 系統を合算に渡すときに使う。`resolveSkillRoll` は4系統が必ず揃っている前提なので、
 * 呼び出し側で分岐させず「効かない修正」を渡す形にしている。
 */
export const NO_MODIFIER: ModifierSet = Object.freeze({ bonus: 0, success: 0, target: 0 });

/**
 * 修正の組を足し合わせる。
 *
 * 技能判定は5系統（技能・能力値・技能グループ・全体・その場）を、共鳴判定は
 * 2系統（共鳴値への効果・その場）を畳む。系統の数が違うだけで畳み方は同じなので、
 * 判定の種類ごとに書かない。
 */
export const sumModifiers = (...sets: ModifierSet[]): ModifierSet =>
  sets.reduce<ModifierSet>(
    (total, mod) => ({
      bonus: total.bonus + mod.bonus,
      success: total.success + mod.success,
      target: total.target + mod.target,
    }),
    { bonus: 0, success: 0, target: 0 },
  );

/** 判定1回分の確定した内容。Roll を組み立てるのに必要な値がすべて入っている */
export type RollSpec = {
  /** 振るダイスの数 */
  diceCount: number;
  /** 各ダイスの目標値（これ以下で成功） */
  target: number;
  /** 成功数に足し引きする固定値 */
  successMod: number;
  /** チャットに出す「2DM≦6」形式の式 */
  dmFormula: string;
};

/**
 * DM式の一項を組み立てる。修正がなければ基準値だけ、あれば括弧でくくって符号を添える。
 *
 * 「2DM≦6」「(2+6)DM≦(5-2)」のように、判定の内訳が読み取れる形にするためのもの。
 * 式の見せ方は判定ルールの一部なのでこの層に置く。技能判定も共鳴判定も同じ形で見せる。
 */
export function formatDMPart(base: number, modifier: number): string {
  if (!modifier) return `${base}`;
  const sign = modifier > 0 ? `+${modifier}` : modifier;
  return `(${base}${sign})`;
}
