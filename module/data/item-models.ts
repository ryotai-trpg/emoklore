import {
  type AttackSkillKey,
  attackSkillChoices,
  attackSkills,
  type DamageDie,
  type RangeType,
} from "../config/attack-skills";
import { EmokloreSystemDataModel } from "./system-model";

const { HTMLField, StringField } = foundry.data.fields;

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
    notes: new HTMLField({ required: true, blank: true }),
  };
};

export class WeaponDataModel extends EmokloreSystemDataModel {
  declare skill: AttackSkillKey;
  declare attackPower: string;
  declare range: string;
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

    // 技能が未知のキーなら近接の既定に倒す。choices で弾かれるはずだが、
    // 手書きのデータやCONFIGを触るモジュールで壊れないようにしておく
    const config = attackSkills[this.skill] ?? attackSkills.fight;

    this.rangeType = config.rangeType;
    this.damageDie = config.damageDie;
    this.usesBaseSkill = config.base;
  }
}
