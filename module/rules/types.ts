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
