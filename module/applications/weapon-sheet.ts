import { systemPath } from "../constants";
import type { WeaponDataModel } from "../data/item-models";
import type { EmokloreItem } from "../documents/item";
import { enrichDocumentHTML } from "../utils/sheet";
import { formatDamagePreview, localizeAttackSkill, localizeRangeType } from "../utils/weapon";
import { EmokloreItemSheet } from "./item-sheet";
import type { EmokloreRenderOptions, WeaponContext } from "./types";

/**
 * weaponアイテムのシート。
 *
 * 項目が少ないのでタブは作らず、ヘッダと詳細の2パートだけにしている。
 * 寸法・クラス・モード切替は EmokloreItemSheet が持つ。
 */
export class EmokloreWeaponSheet extends EmokloreItemSheet {
  // このシートは registerSheet で types: ["weapon"] に限って登録しているので、
  // item は必ず武器。種別ごとのデータモデルは本体の型に出ないのでここで宣言する
  declare item: EmokloreItem & { system: WeaponDataModel };

  static override DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    classes: [...super.DEFAULT_OPTIONS.classes, "weapon"],
  };

  static override PARTS = {
    header: EmokloreItemSheet.HEADER_PART,
    detail: {
      template: systemPath("templates/item/weapon-detail.hbs"),
      templates: ["templates/partials/field.hbs"].map(systemPath),
      scrollable: [""],
    },
  };

  override async _prepareContext(options: EmokloreRenderOptions): Promise<WeaponContext> {
    // 基底のコンテキストはドキュメント種別を問わない形なので、
    // weaponシートであることが分かっているここで1回だけ絞る
    const baseContext = await super._prepareContext(options);
    const context = baseContext as WeaponContext;
    const system = this.item.system;

    context.attackSkillLabel = localizeAttackSkill(system.skill);
    context.rangeTypeLabel = localizeRangeType(system.rangeType);
    // 近接武器の射程は間合いと同じ表示になるので、閲覧では出さない（同じことを2度書かない）。
    // 出すときは必ず記入済みの遠隔武器なので、射程はそのまま見せればよい
    context.showRange = system.rangeType === "ranged" && Boolean(system.range);
    context.damagePreview = formatDamagePreview(system.damageDie, system.attackPower);
    context.notesHTML = await enrichDocumentHTML(this.item, system.notes);

    return context;
  }
}
