import { systemPath } from "../constants";
import type { NpcDataModel } from "../data/npc";
import type { EmokloreActor } from "../documents/actor";
import type { EmokloreItem } from "../documents/item";
import { typedEntries } from "../utils/object";
import { createDocumentData, resolveEmbeddedDocumentClass } from "../utils/sheet";
import { describeSkill, describeSkillLabel } from "../utils/skill";
import { formatDamagePreview, formatRangeLabel } from "../utils/weapon";
import { EmokloreActorSheet } from "./actor-sheet";
import type { EmokloreRenderOptions, NpcSheetContext } from "./types";

/**
 * 人間NPCのシート。
 *
 * 能力値・技能で共鳴者と同じ判定を振れる軽量版。感情・経歴・キャラポイント予算は持たず、
 * 能力値／HP・MP／技能／武器を1画面に並べる。判定はベースの `EmokloreActorSheet` の
 * `roll` アクションにそのまま乗せる（共鳴者と同じ計算を使う）。
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
      viewDoc: this._viewDoc,
      createDoc: this._createDoc,
      deleteDoc: this._deleteDoc,
    },
  };

  static override PARTS = {
    main: {
      template: systemPath("templates/actor/npc-sheet.hbs"),
      scrollable: [""],
    },
  };

  override async _prepareContext(options: EmokloreRenderOptions): Promise<NpcSheetContext> {
    const context = (await super._prepareContext(options)) as NpcSheetContext;
    const system = this.actor.system;

    context.characteristics = typedEntries(CONFIG.EMOKLORE.characteristics).map(
      ([key, { label, fa }]) => ({
        key,
        label,
        icon: fa,
        value: system.characteristics[key].value,
        name: `system.characteristics.${key}.value`,
      }),
    );

    context.skills = typedEntries(CONFIG.EMOKLORE.skills).map(([key]) => {
      const entry = system.skills[key];
      return {
        ...describeSkill({ kind: "skill", key }, entry.characteristic),
        key,
        rollType: "skill",
        level: entry.level,
        target: entry.target,
        name: `system.skills.${key}.level`,
      };
    });

    // プレイ画面では未修得（Lv.0）の技能を並べない（共鳴者シートと同じ）。編集では全技能を出す
    if (context.isPlay) {
      context.skills = context.skills.filter((skill) => skill.level > 0);
    }

    context.baseSkills = typedEntries(system.baseSkills).map(([key, entry]) => ({
      ...describeSkill({ kind: "base", key }, entry.characteristic),
      key,
      rollType: "base-skill",
      level: entry.level,
      target: entry.target,
      name: "",
    }));

    context.customSkills = Object.entries(system.customSkills).map(([id, entry]) => ({
      ...describeSkillLabel({
        kind: "custom",
        label: entry.label,
        isBase: entry.isBase,
        isExtra: entry.isExtra,
      }),
      id,
      level: entry.level,
      target: entry.target,
    }));

    // 武器は一覧と使用まで。値の編集は武器シートが持つ（同じ name の入力を二重に描かない）。
    // itemTypes は本体が Record<string, Item[]> で型付けており、実装クラスまで絞られない
    context.weapons = ((this.actor.itemTypes.weapon ?? []) as EmokloreItem[])
      .filter((item) => item.isWeapon())
      .map((item) => ({
        id: item.id ?? "",
        name: item.name,
        img: item.img,
        rangeLabel: formatRangeLabel(item.system.rangeType, item.system.range),
        damagePreview: formatDamagePreview(item.system.damageDie, item.system.attackPower),
      }));

    return context;
  }

  static async _viewDoc(this: EmokloreNpcSheet, _event: Event, target: HTMLElement) {
    const id = target.closest<HTMLElement>("[data-item-id]")?.dataset.itemId;
    if (id) this.actor.items.get(id)?.sheet?.render(true);
  }

  static async _deleteDoc(this: EmokloreNpcSheet, _event: Event, target: HTMLElement) {
    const id = target.closest<HTMLElement>("[data-item-id]")?.dataset.itemId;
    if (id) await this.actor.items.get(id)?.delete();
  }

  static async _createDoc(
    this: EmokloreNpcSheet,
    _event: Event,
    target: HTMLElement & { dataset: DOMStringMap },
  ) {
    const docData = createDocumentData(target, this.actor);
    const docCls = resolveEmbeddedDocumentClass(target.dataset.documentClass);
    await docCls.create(docData, { parent: this.actor });
  }
}
