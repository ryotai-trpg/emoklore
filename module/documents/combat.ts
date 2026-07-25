import { createSurvivalReminderMessage } from "../chat/survival-reminder";
import type { CombatDataModel } from "../data/combat";
import { getSetting } from "../settings";
import type { EmokloreCombatant } from "./combatant";

/**
 * Combat のドキュメント実装。全Combatを、イニシアチブ基準を持つ型付き（standard）に寄せる。
 */
export class EmokloreCombat extends Combat {
  // CONFIG.Combat.dataModels.standard に CombatDataModel を登録し、_initializeSource で全Combatを
  // standard に寄せているので、system は常に CombatDataModel（本体JSDocの型には出ないため補う）
  declare system: CombatDataModel;
  // 埋め込みコレクションも本体JSDocの型に出ないため補う（EmokloreActor#items と同じ）
  declare combatants: foundry.utils.Collection<string, EmokloreCombatant>;

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

  /**
   * 全Combatantを現在の基準で再算出する。
   *
   * 本体の roll all は initiative 未設定のものだけを振るが、こちらは基準を変えたあと全員へ
   * 反映するため、既に値があっても振り直す。イニシアチブはダイスを含まない決定的な値なので、
   * 振り直しても手動で並べ替えたぶん以外は変わらない。トラッカーの「全員再算出」から呼ぶ。
   */
  async recomputeAll(): Promise<this> {
    const ids = this.combatants
      .map((combatant) => combatant.id)
      .filter((id): id is string => id !== null);
    return this.rollInitiative(ids, { updateTurn: false });
  }

  /**
   * ラウンド終了時、【心肺停止】のキャラクターに〈＊生存〉判定を促すリマインダを出す。
   *
   * 本体の #triggerTurnEvents はGM限定なので、リマインダはGMのクライアントで1枚だけ作られる。
   * 表示のみで、判定の強制や【死亡】の自動付与はしない（#86 と同じ方針）。ラウンド進行が線形な
   * 通常の進み方でこのフックは発火する。
   */
  override async _onEndRound(context: Parameters<Combat["_onEndRound"]>[0]): Promise<void> {
    await super._onEndRound(context);

    if (!getSetting("autoSurvivalReminder")) return;

    const targets = this.combatants
      .filter((combatant) => combatant.actor?.statuses.has("cardiacArrest"))
      .map((combatant) => ({
        actorUuid: combatant.actor?.uuid ?? null,
        name: combatant.name ?? "",
      }));

    if (targets.length > 0) await createSurvivalReminderMessage(targets, context.round);
  }
}
