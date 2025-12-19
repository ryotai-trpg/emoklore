import EmokloreDocumentSheetMixin from "./document-sheet-mixin";
import type { EmokloreItem } from "../documents/item";
import type { EmokloreDocumentSheetContext } from "./types";

/**
 * Weapon Item Sheet
 * @extends {ItemSheetV2}
 */
export class EmokloreWeaponSheet extends EmokloreDocumentSheetMixin(
  foundry.applications.sheets.ItemSheetV2,
) {
  declare item: EmokloreItem;

  static override DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    classes: ["emoklore", "weapon"],
    tag: "form",
  };

  static PARTS = {
    header: {
      template: "systems/emoklore/templates/item/weapon-header.hbs",
    },
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    detail: {
      template: "systems/emoklore/templates/item/weapon-detail.hbs",
      scrollable: [""],
    },
  };

  static TABS = {
    primary: {
      tabs: [{ id: "detail" }],
      labelPrefix: "EMOKLORE.ItemSheet.tab",
      initial: "detail",
    },
  };

  override async _prepareContext(
    options: Record<string, unknown>,
  ): Promise<EmokloreDocumentSheetContext> {
    const context = (await super._prepareContext(options)) as EmokloreDocumentSheetContext;
    // Ensure fields is available for formInput helper (ItemSheetV2 standard)
    if (!context.fields) {
      context.fields = (this.item.constructor as any).schema.fields;
    }
    // Ensure source is available (ItemSheetV2 standard, though we use document)
    if (!context.source) {
      context.source = this.item.toObject();
    }
    return context;
  }

  async _preparePartContext(
    partId: string,
    context: EmokloreDocumentSheetContext,
    options: Record<string, unknown>,
  ): Promise<EmokloreDocumentSheetContext> {
    await super._preparePartContext(partId, context, options);

    const tabs = context.tabs as Record<string, unknown> | undefined;
    if (tabs && partId in tabs) {
      (context as any).tab = tabs[partId];
    }
    return context;
  }

}

