import { CharacterLikeDataModel } from "./character-like";

/**
 * 人間NPCのデータモデル。
 *
 * ルールブックに「人間のNPCに専用ルールは無く、判定が要るなら共鳴者と同じ作りになる」ため、
 * 能力値・技能・派生値・技能判定は共鳴者と同じ `CharacterLikeDataModel` をそのまま継承する。
 * 共鳴者との違いは持たないもの側にある — 共鳴値・共鳴感情・経歴・キャラポイント予算を持たず、
 * シートも軽量にする。判定の計算は共鳴者と1つの実装を共有する。
 *
 * かつては `wickedness`（邪気）だけを持つ登録外の stub だった。邪気はルールブックに該当が
 * 無いので落とした（Issue #81）。怪異の「強度」は共鳴強度で、邪気とは別物。
 */
export class NpcDataModel extends CharacterLikeDataModel {
  static override LOCALIZATION_PREFIXES = ["EMOKLORE.Actor.npc"];
}
