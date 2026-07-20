import { systemPath } from "../constants";
import type { WeaponDataModel } from "../data/item-models";
import type { EmokloreItem } from "../documents/item";
import { formatDamagePreview, localizeAttackSkill, localizeRangeType } from "../utils/weapon";
import EmokloreDocumentSheetMixin from "./document-sheet-mixin";
import type { EmokloreRenderOptions, WeaponContext } from "./types";

/**
 * weaponアイテムのシート。
 *
 * 項目が少ないのでタブは作らず、ヘッダと詳細の2パートだけにしている。
 * 閲覧と編集の出し分けとモード切替は document-sheet-mixin が持つ。
 */
export class EmokloreWeaponSheet extends EmokloreDocumentSheetMixin(
  foundry.applications.sheets.ItemSheetV2,
) {
  declare item: EmokloreItem;

  // classes / window / form は mixin 側の DEFAULT_OPTIONS が継承チェーン経由でマージされる。
  // standard-form は本体の .form-group のレイアウト規則が必要なので自分で足す
  static override DEFAULT_OPTIONS = {
    classes: ["standard-form", "weapon"],
    position: {
      width: 420,
      height: 480,
    },
  };

  static override PARTS = {
    header: { template: systemPath("templates/item/header.hbs") },
    detail: {
      template: systemPath("templates/item/weapon-detail.hbs"),
      scrollable: [""],
    },
  };

  override async _prepareContext(options: EmokloreRenderOptions): Promise<WeaponContext> {
    // 基底のコンテキストはドキュメント種別を問わない形なので、
    // weaponシートであることが分かっているここで1回だけ絞る
    const baseContext = await super._prepareContext(options);
    const context = baseContext as WeaponContext;
    const system = this.item.system as WeaponDataModel;

    context.attackSkillLabel = localizeAttackSkill(system.skill);
    context.rangeTypeLabel = localizeRangeType(system.rangeType);
    // 近接武器の射程は間合いと同じ表示になるので、閲覧では出さない（同じことを2度書かない）。
    // 出すときは必ず記入済みの遠隔武器なので、射程はそのまま見せればよい
    context.showRange = system.rangeType === "ranged" && Boolean(system.range);
    context.damagePreview = formatDamagePreview(system.damageDie, system.attackPower);

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
