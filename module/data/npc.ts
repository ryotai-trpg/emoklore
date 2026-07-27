import type { BaseSkillKey } from "../config/base-skills";
import { CharacterLikeDataModel } from "./character-like";

const { SetField, StringField } = foundry.data.fields;

/**
 * 人間NPCのデータモデル。
 *
 * ルールブックに「人間のNPCに専用ルールは無く、判定が要るなら共鳴者と同じ作りになる」ため、
 * 能力値・技能・派生値・技能判定は共鳴者と同じ `CharacterLikeDataModel` をそのまま継承する。
 * 共鳴者との違いは持たないもの側にある — 共鳴値・共鳴感情・経歴・キャラポイント予算を持たず、
 * シートも軽量にする。判定の計算は共鳴者と1つの実装を共有する。
 *
 * **「邪気」は持たない。** ルールブックに該当が無く、怪異の「強度」は共鳴強度で別物。
 */
export class NpcDataModel extends CharacterLikeDataModel {
  /** 閲覧モードで並べる基本技能。空なら基本技能の欄そのものを出さない */
  declare shownBaseSkills: Set<BaseSkillKey>;

  static override defineSchema() {
    return {
      ...super.defineSchema(),

      /**
       * 閲覧モードに出す基本技能。
       *
       * 基本技能は13件すべてがレベル1固定で、通常技能の「未修得（Lv.0）は隠す」に当たる
       * 基準が無い。どれを見せるかはシナリオがそのNPCに何を求めるかで決まるので、
       * アクターごとの選択として持つ。**共鳴者と共有する `baseSkills` には足さない** —
       * あちらは13件すべてをチップ列に出すのが正しく、選ぶ理由が無い。
       */
      shownBaseSkills: new SetField(
        new StringField({
          required: true,
          blank: false,
          choices: Object.keys(CONFIG.EMOKLORE.baseSkills),
        }),
      ),
    };
  }

  /**
   * 能力値・技能・HP/MP は共鳴者と同じスキーマなので、フィールドのラベルも共鳴者のものを流用する。
   * NPCだけが持つフィールドは自分の名前空間に置く（本体は各プレフィクスの `FIELDS` を
   * 前から順に重ねるので、後ろの `npc` が同名を上書きできる）。
   */
  static override LOCALIZATION_PREFIXES = ["EMOKLORE.Actor.character", "EMOKLORE.Actor.npc"];
}
