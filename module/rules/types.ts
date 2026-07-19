/** 技能・能力値・技能グループが共通で持つ修正値の組 */
export type ModifierSet = {
  bonus: number;
  success: number;
  target: number;
};

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
