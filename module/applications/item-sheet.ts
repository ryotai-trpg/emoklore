import { systemPath } from "../constants";
import type { EmokloreItem } from "../documents/item";
import EmokloreDocumentSheetMixin from "./document-sheet-mixin";

/**
 * アイテムシートの共通部分。
 *
 * アクター側の `EmokloreActorSheet` と対になる。どの種別でもヘッダは同じ
 * （`templates/item/header.hbs`）で、寸法とモード切替の作法も揃えたいので、
 * 種別ごとのシートは詳細パートと context の整形だけを持てばよい形にしている。
 *
 * `item` はCSSの印。本体はアイテムシートに種別共通のクラスを付けないため、
 * `css/applications/item-sheet.css` が掴めるようここで名乗る。
 */
export class EmokloreItemSheet extends EmokloreDocumentSheetMixin(
  foundry.applications.sheets.ItemSheetV2,
) {
  declare item: EmokloreItem;

  // classes / window / form は mixin 側の DEFAULT_OPTIONS が継承チェーン経由でマージされる。
  // standard-form は本体の .form-group のレイアウト規則が必要なので自分で足す
  static override DEFAULT_OPTIONS = {
    classes: ["standard-form", "item"],
    position: {
      width: 420,
      height: 480,
    },
  };

  // 詳細パートは種別ごとに違うので、サブクラスが PARTS ごと宣言し直す。
  // ヘッダのパスをここに置いておき、写し間違いを防ぐ
  static readonly HEADER_PART = { template: systemPath("templates/item/header.hbs") };
}
