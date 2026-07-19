import type { EmokloreSystemDataModel } from "../data/system-model";

export class EmokloreItem extends Item {
  // スキーマ由来のプロパティは本体JSDocの型に出ないため補強する
  declare system: EmokloreSystemDataModel;
  declare effects: foundry.utils.Collection<string, foundry.documents.ActiveEffect>;
}
