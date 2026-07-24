import type { CombatDataModel } from "../data/combat";

/**
 * Combat のドキュメント実装。全Combatを、イニシアチブ基準を持つ型付き（standard）に寄せる。
 */
export class EmokloreCombat extends Combat {
  // CONFIG.Combat.dataModels.standard に CombatDataModel を登録し、_initializeSource で全Combatを
  // standard に寄せているので、system は常に CombatDataModel（本体JSDocの型には出ないため補う）
  declare system: CombatDataModel;

  /**
   * 種別未指定・base のCombatを standard に寄せる。
   *
   * Combatは作成時に種別を選ばせず、既定では base（システムデータなし）で作られる。全Combatを
   * standard として初期化し、イニシアチブ基準を必ず持たせる。読み込み時にも通るので、base で
   * 作られた既存のCombatも standard に上がる。
   */
  protected override _initializeSource(
    data: Parameters<Combat["_initializeSource"]>[0],
    options?: Parameters<Combat["_initializeSource"]>[1],
  ): ReturnType<Combat["_initializeSource"]> {
    const source = data as { type?: string };
    if (!source.type || source.type === "base") source.type = "standard";
    return super._initializeSource(data, options);
  }
}
