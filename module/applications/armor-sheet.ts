import { systemPath } from "../constants";
import type { ArmorDataModel } from "../data/item-models";
import type { EmokloreItem } from "../documents/item";
import { enrichDocumentHTML } from "../utils/sheet";
import { EmokloreItemSheet } from "./item-sheet";
import type { ArmorContext, EmokloreRenderOptions } from "./types";

/**
 * armorアイテムのシート。
 *
 * 武器シートと同じくヘッダと詳細の2パートだけ。派生値を持たないぶんさらに薄い。
 */
export class EmokloreArmorSheet extends EmokloreItemSheet {
  // registerSheet で types: ["armor"] に限って登録しているので、item は必ず防具
  declare item: EmokloreItem & { system: ArmorDataModel };

  static override DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    classes: [...super.DEFAULT_OPTIONS.classes, "armor"],
  };

  static override PARTS = {
    header: EmokloreItemSheet.HEADER_PART,
    detail: {
      template: systemPath("templates/item/armor-detail.hbs"),
      scrollable: [""],
    },
  };

  override async _prepareContext(options: EmokloreRenderOptions): Promise<ArmorContext> {
    const baseContext = await super._prepareContext(options);
    const context = baseContext as ArmorContext;
    const system = this.item.system;

    // 未記入の適用条件は行ごと出さない（空のラベルだけが並ぶのを避ける）
    context.showCoverage = Boolean(system.coverage);
    context.notesHTML = await enrichDocumentHTML(this.item, system.notes);

    return context;
  }
}
