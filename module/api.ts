/**
 * システムが外へ公開する操作。`game.system.api` から呼べる。
 *
 * マクロとモジュールの接続面。判定やダメージの差し替えは `emoklore.*` のフック群が
 * 引き受けるが（`docs/architecture.md`「武器カードのフック」）、あちらは**割り込む**ための
 * 口で、こちらは**呼ぶ**ための口になる。
 *
 * **並べるのは、UIを経由せずに呼ぶ意味があるものだけ。** 内部の関数をここへ足すと、
 * 外から見える約束が増えて動かせなくなる。
 */

import { applyDamageAndReport } from "./applications/damage";
import { requestResonanceCheck, requestSkillCheck } from "./applications/requests";

export type EmokloreApi = {
  /** ダメージを対象へ適用し、結果をチャットに流す。権限が無ければGMへ委譲する */
  applyDamageAndReport: typeof applyDamageAndReport;
  /** DLからの技能判定要求をチャットに出す。内容はダイアログで尋ねる */
  requestSkillCheck: typeof requestSkillCheck;
  /** DLからの共鳴判定要求をチャットに出す。内容はダイアログで尋ねる */
  requestResonanceCheck: typeof requestResonanceCheck;
};

export const api: EmokloreApi = {
  applyDamageAndReport,
  requestSkillCheck,
  requestResonanceCheck,
};
