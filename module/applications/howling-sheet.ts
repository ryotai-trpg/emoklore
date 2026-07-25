import { systemPath } from "../constants";
import type { HowlingDataModel } from "../data/item-models";
import type { EmokloreItem } from "../documents/item";
import { localizeHowlingCategory } from "../utils/howling";
import { enrichDocumentHTML } from "../utils/sheet";
import { formatSkillRefs } from "../utils/skill";
import { EmokloreItemSheet } from "./item-sheet";
import type { EmokloreRenderOptions, HowlingContext } from "./types";

/**
 * howlingアイテム（ハウリング反応）のシート。
 *
 * 武器・防具と同じくヘッダと詳細の2パート。判定への修正は ActiveEffect が持つので、
 * ここで編集するのは分類・記述・回復条件という「反応の定義」になる。
 */
export class EmokloreHowlingSheet extends EmokloreItemSheet {
  // registerSheet で types: ["howling"] に限って登録しているので、item は必ずハウリング反応
  declare item: EmokloreItem & { system: HowlingDataModel };

  static override DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    classes: [...super.DEFAULT_OPTIONS.classes, "howling"],
  };

  static override PARTS = {
    header: EmokloreItemSheet.HEADER_PART,
    detail: {
      template: systemPath("templates/item/howling-detail.hbs"),
      scrollable: [""],
    },
  };

  override async _prepareContext(options: EmokloreRenderOptions): Promise<HowlingContext> {
    const baseContext = await super._prepareContext(options);
    const context = baseContext as HowlingContext;
    const system = this.item.system;

    context.categoryLabel = localizeHowlingCategory(system.category);
    // 閲覧では印つきで並べる。編集は SetField の choices がそのまま複数選択になる
    context.recoverySkillLabel = formatSkillRefs(system.recovery.skills);
    context.effectHTML = await enrichDocumentHTML(this.item, system.effect);
    context.notesHTML = await enrichDocumentHTML(this.item, system.notes);

    return context;
  }
}
