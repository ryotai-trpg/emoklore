import {
  type AttackSkillKey,
  attackSkillChoices,
  type DamageDie,
  type RangeType,
} from "../config/attack-skills";
import { type CharacteristicKey, characteristicChoices } from "../config/characteristics";
import { type HowlingCategory, howlingCategoryChoices } from "../config/howling-categories";
import { type SkillCategory, skillCategoryChoices } from "../config/skill-categories";
import { type SkillGroupKey, skillGroupChoices } from "../config/skill-groups";
import { SKILL_LEVEL_MAX, SKILL_LEVEL_MIN } from "../rules/limits";
import { skillRefChoices } from "../utils/skill";
import { resolveAttackSkill } from "../utils/weapon";
import { EmokloreSystemDataModel } from "./system-model";

const { BooleanField, HTMLField, NumberField, SchemaField, SetField, StringField } =
  foundry.data.fields;

const defineWeaponDataModelSchema = () => {
  return {
    skill: new StringField({
      required: true,
      blank: false,
      // choices の値は翻訳済み文字列ではなくi18nキー。描画時に本体が解決する
      choices: attackSkillChoices,
      initial: "fight" satisfies AttackSkillKey,
    }),
    // 攻撃力は数値ではなく式。ルールブックの例が 肉体(1)・棒(2) と ナイフ(1D3)・拳銃(2D6) を
    // 同じ「武器攻撃力」として並べているため、どちらも書ける形にする
    attackPower: new StringField({
      required: true,
      blank: true,
      initial: "",
      // 妥当なら undefined を返す。true を返すと後続のバリデータが飛ばされる
      // （common/data/fields.mjs の DataField#validators を参照）
      validate: (value: unknown) => {
        if (typeof value === "string" && !foundry.dice.Roll.validate(value)) return false;
        return undefined;
      },
      validationError: "is not a valid dice formula",
    }),
    // ルールブックに距離の規定がないので自由記述。近接武器では使わない
    range: new StringField({ required: true, blank: true, initial: "" }),
    // いま構えているかの記録。防具と違って機構には繋がっていない。
    // 武器は「携行はするが構えていない」が常態なので既定 false
    equipped: new BooleanField({ required: true, initial: false }),
    notes: new HTMLField({ required: true, blank: true }),
  };
};

export class WeaponDataModel extends EmokloreSystemDataModel {
  declare skill: AttackSkillKey;
  declare attackPower: string;
  declare range: string;
  declare equipped: boolean;
  declare notes: string;

  // 参照技能から引ける派生値。prepareDerivedData で必ず設定される
  declare rangeType: RangeType;
  declare damageDie: DamageDie;
  declare usesBaseSkill: boolean;

  static override defineSchema() {
    return defineWeaponDataModelSchema();
  }

  static override LOCALIZATION_PREFIXES = ["EMOKLORE.Item.weapon"];

  /**
   * 間合いとダメージダイスを参照技能から引く。
   *
   * ルール上この2つは技能に紐づいており、武器が独立して持つと矛盾したデータを保存できてしまう。
   * 定義は CONFIG.EMOKLORE.attackSkills が正。
   */
  override prepareDerivedData() {
    super.prepareDerivedData();

    const config = resolveAttackSkill(this.skill);

    this.rangeType = config.rangeType;
    this.damageDie = config.damageDie;
    this.usesBaseSkill = config.base;
  }
}

/**
 * 防具。書籍版ルールブックの「防御力（受けるダメージから引く固定値）＋適用部位の条件」を
 * 受ける器。書籍固有のアイテムデータは同梱せず、値はユーザーが書く。
 */
const defineArmorDataModelSchema = () => {
  return {
    // 書籍の防具は固定値だけで、武器攻撃力と違ってダイス式は出てこないので数値
    defense: new NumberField({
      required: true,
      nullable: false,
      integer: true,
      min: 0,
      initial: 0,
    }),
    // 「ヘルメットは頭部のみ」のような適用条件。当たったかの判断はDL裁量で、
    // 機構が無いので自由記述（weapon.range と同じ扱い）
    coverage: new StringField({ required: true, blank: true, initial: "" }),
    // 装備中の防具だけがダメージの軽減に数えられる。防具は「着ている」が常態なので既定 true
    // （敵に防具を1つ作ればそのまま装甲として働く）
    equipped: new BooleanField({ required: true, initial: true }),
    notes: new HTMLField({ required: true, blank: true }),
  };
};

export class ArmorDataModel extends EmokloreSystemDataModel {
  declare defense: number;
  declare coverage: string;
  declare equipped: boolean;
  declare notes: string;

  static override defineSchema() {
    return defineArmorDataModelSchema();
  }

  static override LOCALIZATION_PREFIXES = ["EMOKLORE.Item.armor"];
}

/**
 * カスタム技能。ルールブックが「シナリオや舞台設定などに合わせて、オリジナルの技能を
 * 用意しても構いません」と認めているぶんを受ける器。
 *
 * 組込の35技能＋13基本技能は `system.skills` / `system.baseSkills` に固定キーで居るまま。
 * こちらを足すだけなので既存データは動かない。Itemにしてあるのは、コンペンディウムに
 * 入れて配ったり他のキャラクターへドラッグで渡したりを本体任せで済ませるため。
 */
const defineSkillDataModelSchema = () => {
  return {
    // 組込技能は「どの表に居るか」と isExtra で区分を表すが、こちらは表が1つなので値で持つ
    category: new StringField({
      required: true,
      blank: false,
      // choices の値は翻訳済み文字列ではなくi18nキー。描画時に本体が解決する
      choices: skillCategoryChoices,
      initial: "normal" satisfies SkillCategory,
    }),
    // 【身体 or 器用】のように複数から選べる技能があるので、取りうる能力値は集合で持つ。
    // 1件なら静的表示、2件以上ならシートに選択欄が出る（組込技能が choices の有無で
    // 出し分けているのと同じ判断を、Itemでは件数で行う。スキーマは全インスタンス共通なので
    // choices を技能ごとに変えられない）
    characteristicOptions: new SetField(
      new StringField({ required: true, blank: false, choices: characteristicChoices }),
      { required: true, initial: ["physical" satisfies CharacteristicKey] },
    ),
    // characteristicOptions のどれを今使っているか。範囲外になったら prepareDerivedData が直す
    characteristic: new StringField({
      required: true,
      blank: false,
      choices: characteristicChoices,
      initial: "physical" satisfies CharacteristicKey,
    }),
    // 「交渉系すべてに+1」のような効果を乗せるための所属。持たない技能もあるので blank を許す
    group: new StringField({
      required: true,
      blank: true,
      choices: skillGroupChoices,
      initial: "",
    }),
    // ベース技能はレベルを持たない（常に1扱い）。区分ごとに min/max を変えられないので、
    // スキーマは0〜3を許したまま、判定に使う側（calculateCustomSkillLevel）が固定する
    level: new NumberField({
      required: true,
      nullable: false,
      integer: true,
      min: SKILL_LEVEL_MIN,
      max: SKILL_LEVEL_MAX,
      initial: 0,
    }),
    notes: new HTMLField({ required: true, blank: true }),
  };
};

export class SkillDataModel extends EmokloreSystemDataModel {
  declare category: SkillCategory;
  declare characteristicOptions: Set<CharacteristicKey>;
  declare characteristic: CharacteristicKey;
  declare group: SkillGroupKey | "";
  declare level: number;
  declare notes: string;

  declare isBase: boolean;
  declare isExtra: boolean;

  static override defineSchema() {
    return defineSkillDataModelSchema();
  }

  static override LOCALIZATION_PREFIXES = ["EMOKLORE.Item.skill"];

  /**
   * 区分から導ける値をまとめて置く。
   *
   * `characteristic` の整合もここで取る。作者が参照能力値を絞ったあとも古い値が
   * 残っていると、アクター側が持たない能力値を引いて TypeError になる。
   * スキーマの choices は「8種のどれか」しか見ておらず、options の範囲までは見ない
   */
  override prepareDerivedData() {
    super.prepareDerivedData();

    this.isBase = this.category === "base";
    this.isExtra = this.category === "extra";

    if (!this.characteristicOptions.has(this.characteristic)) {
      // 集合が空になることは required で防いでいるが、値が無ければ既定に戻す
      const [fallback] = this.characteristicOptions;
      this.characteristic = fallback ?? "physical";
    }
  }
}

/**
 * ハウリング反応。共鳴表（RollTable）が引く先で、引いた結果は共鳴者の持ち物になる。
 *
 * **Itemなのは、効果をActiveEffectで持てる唯一の器だから。** `TableResult` は
 * `hasTypeData` を持たず、`Card` は `embedded` を持たない（どちらも本体の metadata）。
 * 「状態になって、条件を満たすと戻る」を、アイテムを持っている間だけ効果が乗る本体の
 * 仕組み（transfer）にそのまま重ねられる — 回復とは、このアイテムを消すことになる。
 */
const defineHowlingDataModelSchema = () => {
  return {
    // 分類は表示だけに使う。効果も回復もここからは導けない（config/howling-categories.ts）
    category: new StringField({
      required: true,
      blank: false,
      // choices の値は翻訳済み文字列ではなくi18nキー。描画時に本体が解決する
      choices: howlingCategoryChoices,
      initial: "unclassified" satisfies HowlingCategory,
    }),
    // 効果とルール処理の記述。機械的な修正は ActiveEffect が持ち、ここはその読み下し。
    // 「即座に〈∞共鳴〉レベルが1増加する」のような一度きりの効果は効果に落とせないので、
    // 文として置いたまま人が処理する
    effect: new HTMLField({ required: true, blank: true }),
    recovery: new SchemaField({
      // 「症状と期間はDLが決定する」「シナリオ中継続」など、判定に落ちない条件
      note: new StringField({ required: true, blank: true, initial: "" }),
      // 「〈＊自我〉あるいは〈心理〉の成功で回復する」を持てるよう複数を許す。
      // 値は「経路:キー」で、通常技能と基本技能を1本の選択肢に混ぜている（utils/skill.ts）。
      // カスタム技能は各アクター固有なので、配り物の反応からは指せない
      skills: new SetField(
        new StringField({ required: true, blank: false, choices: skillRefChoices }),
      ),
    }),
    // フレーバーテキスト。他のアイテム種別と同じ名前で揃える
    notes: new HTMLField({ required: true, blank: true }),
  };
};

export class HowlingDataModel extends EmokloreSystemDataModel {
  declare category: HowlingCategory;
  declare effect: string;
  // skills の中身は「経路:キー」。判定に使うときは parseSkillRefValue を通す
  declare recovery: { note: string; skills: Set<string> };
  declare notes: string;

  static override defineSchema() {
    return defineHowlingDataModelSchema();
  }

  static override LOCALIZATION_PREFIXES = ["EMOKLORE.Item.howling"];
}
