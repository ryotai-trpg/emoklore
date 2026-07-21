import { systemPath } from "../constants";
import type { SkillDataModel } from "../data/item-models";
import type { EmokloreItem } from "../documents/item";
import {
  formatCharacteristicOptions,
  formatSkillGroup,
  localizeSkillCategory,
} from "../utils/skill";
import EmokloreDocumentSheetMixin from "./document-sheet-mixin";
import type { EmokloreRenderOptions, SkillContext } from "./types";

/**
 * skillアイテム（カスタム技能）のシート。
 *
 * 技能レベルと参照能力値はキャラクターシートの行から直接いじれるので、こちらは
 * 「技能そのものの定義」を編集する場所になる。武器シートと同じくタブは作らない。
 */
export class EmokloreSkillSheet extends EmokloreDocumentSheetMixin(
  foundry.applications.sheets.ItemSheetV2,
) {
  // このシートは registerSheet で types: ["skill"] に限って登録しているので、
  // item は必ずカスタム技能。種別ごとのデータモデルは本体の型に出ないのでここで宣言する
  declare item: EmokloreItem & { system: SkillDataModel };

  static override DEFAULT_OPTIONS = {
    classes: ["standard-form", "item", "skill"],
    position: {
      width: 420,
      height: 480,
    },
  };

  static override PARTS = {
    header: { template: systemPath("templates/item/header.hbs") },
    detail: {
      template: systemPath("templates/item/skill-detail.hbs"),
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

    // 備考は system.json で htmlFields に指定しているリッチテキストなので、
    // @UUID リンクやインラインロールを解決するため描画前に enrichHTML を通す
    context.notesHTML = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      system.notes,
      {
        secrets: this.item.isOwner,
        relativeTo: this.item,
        rollData: this.item.getRollData(),
      },
    );

    return context;
  }
}
