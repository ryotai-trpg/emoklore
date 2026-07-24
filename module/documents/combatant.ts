import type { EmokloreCombat } from "./combat";

/**
 * Combatant のドキュメント実装。イニシアチブ式を所属Combatの基準から引く。
 */
export class EmokloreCombatant extends Combatant {
  // スキーマ由来の表示名は本体JSDocの型に出ない（EmokloreActor#name と同じ）
  declare name: string;

  /**
   * イニシアチブ式。所属Combatのイニシアチブ基準（能力値＋技能）から組み立てる。
   *
   * 本体の既定は `CONFIG.Combat.initiative.formula || game.system.initiative`（＝@initiative 固定）を
   * 返すが、基準はエンカウンターごとに変わるので `combat.system.formula` を使う。式は本体の
   * `getInitiativeRoll` が `actor.getRollData()` に対して解決する。roll all / roll NPC / トラッカーの
   * 行ロール・再ロールはすべて `Combat#rollInitiative` → `Combatant#getInitiativeRoll` → ここを通る。
   *
   * combatが無い（未参加）ときだけ super の既定（@initiative）へ戻す。standard に寄せているので、
   * combatがあれば system は常に基準を持つ。
   */
  override _getInitiativeFormula(): string {
    const combat = this.combat as EmokloreCombat | null;
    return combat?.system.formula ?? super._getInitiativeFormula();
  }
}
