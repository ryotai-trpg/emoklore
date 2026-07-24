import type { CharacteristicKey } from "../config/characteristics";
import { characteristicChoices } from "../config/characteristics";
import type { SkillKey } from "../config/skills";
import { skillChoices } from "../config/skills";
import { buildInitiativeFormula } from "../rules/initiative";
import { EmokloreSystemDataModel } from "./system-model";

const { StringField } = foundry.data.fields;

/**
 * エンカウンターのイニシアチブ基準（能力値＋技能）を持つCombatのシステムデータ。
 *
 * ラウンド進行の状況に合わせて基準を選べるようにするための入れ物。`skill` が空文字なら技能を
 * 足さない（【心肺停止】の【器用】単独）。基準からイニシアチブ式を組み立てるのは `formula`。
 */
export class CombatDataModel extends EmokloreSystemDataModel {
  declare characteristic: CharacteristicKey;
  // 空文字は「技能なし」。declare の型は保存データが裏切りうる（StringField なので）
  declare skill: SkillKey | "";

  static override defineSchema() {
    return {
      characteristic: new StringField({
        required: true,
        blank: false,
        initial: "physical",
        choices: characteristicChoices,
      }),
      // choices 付きフィールドは既定で blank 不可になるので、空文字（技能なし）を許すため
      // blank を明示する。空文字は _validateSpecial が choices より先に通す
      skill: new StringField({
        required: true,
        blank: true,
        initial: "speed",
        choices: skillChoices,
      }),
    };
  }

  static override LOCALIZATION_PREFIXES = ["EMOKLORE.Combat"];

  /** ロールに渡すイニシアチブ式。基準から組み立てる（EmokloreCombatant#_getInitiativeFormula が読む） */
  get formula(): string {
    return buildInitiativeFormula({
      characteristic: this.characteristic,
      skill: this.skill || null,
    });
  }
}
