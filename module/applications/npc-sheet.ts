import { isBaseSkillKey } from "../config/base-skills";
import { systemPath } from "../constants";
import type { NpcDataModel } from "../data/npc";
import type { EmokloreActor } from "../documents/actor";
import { EmokloreActorSheet } from "./actor-sheet";
import { buildEffectCategories, buildItemsContext } from "./context/actor";
import { buildNpcSkillsContext } from "./context/npc";
import type { EmokloreRenderOptions, NpcSheetContext } from "./types";

/**
 * 人間NPCのシート。
 *
 * 能力値・技能で共鳴者と同じ判定を振れる軽量版。技能・アイテム・効果の3タブを持ち、
 * 技能タブの行は共鳴者と同じ部品（skills.hbs と行partial）をそのまま使う。感情・経歴・
 * キャラポイント予算は持たない。判定はベースの `EmokloreActorSheet` の `roll` アクションに
 * そのまま乗せる（共鳴者と同じ計算を使う）。
 */
export class EmokloreNpcSheet extends EmokloreActorSheet {
  // type: "npc" にしか登録しないので actor は人間NPCに絞れる
  declare actor: EmokloreActor & { system: NpcDataModel };

  static override DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    classes: ["standard-form", "npc"],
    position: { width: 520, height: 640 },
    actions: {
      ...super.DEFAULT_OPTIONS.actions,
      toggleBaseSkill: this._toggleBaseSkill,
    },
  };

  static override PARTS = {
    header: { template: systemPath("templates/actor/npc-header.hbs") },
    tabs: EmokloreActorSheet.TAB_NAV_PART,
    skills: {
      template: systemPath("templates/actor/npc-skills.hbs"),
      // 入れ子のpartialは再帰的に解決されないので、使うものをすべて並べる
      templates: [
        "templates/actor/skills.hbs",
        "templates/actor/base-skills.hbs",
        "templates/actor/partials/skill-row-play.hbs",
        "templates/actor/partials/skill-row-edit.hbs",
        "templates/actor/partials/custom-skill-row-play.hbs",
        "templates/actor/partials/custom-skill-row-edit.hbs",
        "templates/actor/partials/segments.hbs",
        "templates/partials/doc-controls.hbs",
      ].map(systemPath),
      scrollable: [""],
    },
    // アイテムタブは共鳴者とパートごと共有する。テンプレートはコンテキスト
    // （weapons / armors / isPlay / editable）しか見ないので、そのまま使える
    items: {
      template: systemPath("templates/actor/items.hbs"),
      templates: ["templates/partials/doc-controls.hbs"].map(systemPath),
      scrollable: [""],
    },
    effects: EmokloreActorSheet.EFFECTS_TAB_PART,
  };

  static override TABS = {
    primary: {
      tabs: [{ id: "skills" }, { id: "items" }, { id: "effects" }],
      labelPrefix: "EMOKLORE.Sheet.npc.tab",
      initial: "skills",
    },
  };

  override async _preparePartContext(
    partId: string,
    context: NpcSheetContext,
    options: EmokloreRenderOptions,
  ): Promise<NpcSheetContext> {
    await super._preparePartContext(partId, context, options);

    switch (partId) {
      case "skills":
        Object.assign(context, buildNpcSkillsContext(this.actor, { isPlay: context.isPlay }));
        break;
      case "items":
        Object.assign(context, buildItemsContext(this.actor));
        break;
      case "effects":
        // 共鳴者と違いハウリングの専用区分を持たないので、乗ってしまった効果も隠さず出す
        context.effects = buildEffectCategories(this.actor, { excludeHowlingSources: false });
        break;
      default:
        // header / tabs は追加のコンテキストを必要としないので何もしない
        break;
    }

    return context;
  }

  /**
   * 編集モードのチェックで、閲覧モードに出す基本技能を決める。
   *
   * `name` を持たないチェックボックスから直接書く（`_toggleEquipped` と同じ形）。13個の
   * 同名 input で SetField を送ると `FormDataExtended` の畳み方に寄りかかることになる。
   */
  static async _toggleBaseSkill(
    this: EmokloreNpcSheet,
    _event: Event,
    target: HTMLElement & { dataset: DOMStringMap },
  ) {
    // datasetは生の文字列なので、基本技能のキーとして通ることをここで確かめる
    const key = target.dataset.skill ?? "";
    if (!isBaseSkillKey(key)) return;

    const shown = new Set(this.actor.system.shownBaseSkills);
    if ((target as HTMLInputElement).checked) shown.add(key);
    else shown.delete(key);

    await this.actor.update({ "system.shownBaseSkills": [...shown] });
  }
}
