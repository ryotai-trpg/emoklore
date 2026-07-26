import { isBaseSkillKey } from "../config/base-skills";
import { systemPath } from "../constants";
import type { NpcDataModel } from "../data/npc";
import type { EmokloreActor } from "../documents/actor";
import type { EmokloreItem } from "../documents/item";
import { typedEntries } from "../utils/object";
import { describeSkill, describeSkillLabel, SHEET_CONTEXT } from "../utils/skill";
import { formatDamagePreview, formatRangeLabel } from "../utils/weapon";
import { EmokloreActorSheet } from "./actor-sheet";
import type { EmokloreRenderOptions, NpcSheetContext } from "./types";

/** `sort` はスキーマ由来で本体JSDocの型に出ないため、並べ替えの場面だけ足す */
type SortableItem = EmokloreItem & { sort: number };

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
      toggleBaseSkill: this._toggleBaseSkill,
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

    // 入力の min / max はスキーマから来させる。テンプレートに数値を書くと limits.ts と
    // 黙ってずれる。段階が min・max・step とも決まる数値は既定でスライダーになるので、
    // テンプレート側で type="number" を渡している（本体 NumberField#_toInput）
    context.characteristics = typedEntries(CONFIG.EMOKLORE.characteristics).map(
      ([key, { label, fa }]) => ({
        key,
        label,
        icon: fa,
        value: system.characteristics[key].value,
        field: system.schema.getField(["characteristics", key, "value"]),
      }),
    );

    context.skills = typedEntries(CONFIG.EMOKLORE.skills).map(([key]) => {
      const entry = system.skills[key];
      return {
        ...describeSkill({ kind: "skill", key }, entry.characteristic, SHEET_CONTEXT),
        key,
        rollType: "skill",
        level: entry.level,
        target: entry.target,
        field: system.schema.getField(["skills", key, "level"]),
      };
    });

    // プレイ画面では未修得（Lv.0）の技能を並べない（共鳴者シートと同じ）。編集では全技能を出す
    if (context.isPlay) {
      context.skills = context.skills.filter((skill) => skill.level > 0);
    }

    // 基本技能はレベルが常に1で「未修得」が無いので、Lv.0 のフィルタが使えない。
    // かわりに、どれを出すかをアクターが持つ（`shownBaseSkills`）。編集では選ぶために全件出す
    context.baseSkills = typedEntries(system.baseSkills)
      .map(([key, entry]) => ({
        ...describeSkill({ kind: "base", key }, entry.characteristic, SHEET_CONTEXT),
        key,
        rollType: "base-skill",
        level: entry.level,
        target: entry.target,
        shown: system.shownBaseSkills.has(key),
      }))
      .filter((skill) => !context.isPlay || skill.shown);

    context.customSkills = Object.entries(system.customSkills).map(([id, entry]) => ({
      ...describeSkillLabel(
        {
          kind: "custom",
          label: entry.label,
          isBase: entry.isBase,
          isExtra: entry.isExtra,
        },
        SHEET_CONTEXT,
      ),
      id,
      level: entry.level,
      target: entry.target,
    }));

    // 武器は一覧と使用まで。値の編集は武器シートが持つ（同じ name の入力を二重に描かない）。
    // itemTypes は本体が Record<string, Item[]> で型付けており、実装クラスまで絞られない。
    // 並べ直すのは、本体の itemTypes が保存順で返し sort を見ないため（共鳴者側と同じ）
    context.weapons = ((this.actor.itemTypes.weapon ?? []) as SortableItem[])
      .toSorted((a, b) => a.sort - b.sort)
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
