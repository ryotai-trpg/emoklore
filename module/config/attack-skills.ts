/** 武器の間合い。近接なら射程欄を使わない */
export type RangeType = "melee" | "ranged";

/** ダメージのダイス面。遠隔攻撃はダイスを振らず成功数がそのままダメージになるので null */
export type DamageDie = "d3" | "d6" | null;

export interface AttackSkillConfig {
  /** i18nキー。技能・基本技能どちらのラベルを指すかは base で決まる */
  label: string;
  /** 基本技能なら true。判定を引くとき system.baseSkills 側を見る必要がある */
  base: boolean;
  rangeType: RangeType;
  damageDie: DamageDie;
}

/**
 * 攻撃に使える技能と、そのダメージの決まり方。
 *
 * ルールブックではダメージ式が武器ではなく技能の側に書かれている。
 * 〈＊格闘〉〈武術〉は【成功数】D3＋武器攻撃力、〈★奥義〉は【成功数】D6＋武器攻撃力、
 * 〈＊投擲〉〈★射撃〉は【成功数】＋武器攻撃力。
 * つまり武器が持つべきなのは攻撃力だけで、間合いとダイスは参照技能から引ける。
 */
const definitions = {
  fight: {
    label: "EMOKLORE.Actor.baseSkills.fight",
    base: true,
    rangeType: "melee",
    damageDie: "d3",
  },
  martialArt: {
    label: "EMOKLORE.Actor.skills.martialArt",
    base: false,
    rangeType: "melee",
    damageDie: "d3",
  },
  secretTechnique: {
    label: "EMOKLORE.Actor.skills.secretTechnique",
    base: false,
    rangeType: "melee",
    damageDie: "d6",
  },
  throw: {
    label: "EMOKLORE.Actor.baseSkills.throw",
    base: true,
    rangeType: "ranged",
    damageDie: null,
  },
  rangedAttack: {
    label: "EMOKLORE.Actor.skills.rangedAttack",
    base: false,
    rangeType: "ranged",
    damageDie: null,
  },
} satisfies Record<string, AttackSkillConfig>;

export type AttackSkillKey = keyof typeof definitions;

/**
 * 攻撃技能のキーかどうか。
 *
 * 武器カードの skill は choices を持たない StringField なので、保存データやフックが
 * 宣言した型を裏切りうる。引く前にここを通す
 */
export const isAttackSkillKey = (value: string): value is AttackSkillKey => value in definitions;

// satisfies だけだと各値が個別の狭い型に推論されるため、値の型は AttackSkillConfig に揃える。
// キーは literal のまま保たれるので AttackSkillKey が使える
export const attackSkills: Record<AttackSkillKey, AttackSkillConfig> = definitions;

/**
 * 武器のスキーマに渡す choices。値は翻訳済み文字列ではなくi18nキーを入れる。
 *
 * ここを preLocalize の対象にしないのは、スキーマ定義が i18nInit より先に走りうるため。
 * テンプレートが formInput に localize=true を渡しており、描画時に本体が解決する
 * （能力値の characteristicOptions と同じ扱い。module/data/character.ts を参照）
 */
export const attackSkillChoices: Record<string, string> = Object.fromEntries(
  Object.entries(attackSkills).map(([key, { label }]) => [key, label]),
);
