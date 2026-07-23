/** 集計に要る防具1件ぶんの値 */
export type ArmorPieceParams = {
  equipped: boolean;
  defense: number;
};

/**
 * 装備中の防具の防御力合計。装備していないものは数えない。
 *
 * 書籍版ルールブックの防具は「防御力：受けるダメージから引く固定値」で、
 * 部位の条件はDL裁量。適用しない防具はダメージ適用のダイアログで外す。
 */
export const calculateArmorTotal = (pieces: ArmorPieceParams[]): number =>
  pieces.reduce((sum, piece) => (piece.equipped ? sum + piece.defense : sum), 0);
