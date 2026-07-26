import { systemPath } from "../constants";
import type { SkillDataModel } from "../data/item-models";
import type { EmokloreItem } from "../documents/item";
import { enrichDocumentHTML } from "../utils/sheet";
import {
  formatCharacteristicOptions,
  formatSkillGroup,
  localizeSkillCategory,
} from "../utils/skill";
import { EmokloreItemSheet } from "./item-sheet";
import type { EmokloreRenderOptions, SkillContext } from "./types";

/**
 * skillアイテム（カスタム技能）のシート。
 *
 * 技能レベルと参照能力値はキャラクターシートの行から直接いじれるので、こちらは
 * 「技能そのものの定義」を編集する場所になる。武器シートと同じくタブは作らない。
 */
export class EmokloreSkillSheet extends EmokloreItemSheet {
  // このシートは registerSheet で types: ["skill"] に限って登録しているので、
  // item は必ずカスタム技能。種別ごとのデータモデルは本体の型に出ないのでここで宣言する
  declare item: EmokloreItem & { system: SkillDataModel };

  static override DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    classes: [...super.DEFAULT_OPTIONS.classes, "skill"],
  };

  static override PARTS = {
    header: EmokloreItemSheet.HEADER_PART,
    detail: {
      template: systemPath("templates/item/skill-detail.hbs"),
      templates: ["templates/partials/field.hbs"].map(systemPath),
      scrollable: [""],
    },
  };

  override async _prepareContext(options: EmokloreRenderOptions): Promise<SkillContext> {
    const baseContext = await super._prepareContext(options);
    const context = baseContext as SkillContext;
    const system = this.item.system;

    context.categoryLabel = localizeSkillCategory(system.category);
    context.characteristicLabel = formatCharacteristicOptions(system.characteristicOptions);
    context.groupLabel = formatSkillGroup(system.group);
    // ベース技能はレベルを持たないので、閲覧でも編集でもレベルの行を出さない
    context.showLevel = !system.isBase;
    context.notesHTML = await enrichDocumentHTML(this.item, system.notes);

    return context;
  }
}
