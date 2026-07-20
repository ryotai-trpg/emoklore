import type { CharacteristicKey } from "../config/characteristics";
import type { SkillKey } from "../config/skills";
import { systemPath } from "../constants";
import type { EmokloreActor } from "../documents/actor";
import {
  CHARACTERISTIC_POINT_MAX,
  calculateCharPointSum,
  calculateTotalSkillPoints,
  SKILL_POINT_MAX,
} from "../rules/character-points";
import { prepareActiveEffectCategories } from "../utils/effects";
import {
  createDocumentData,
  getEmbeddedDocument,
  resolveEmbeddedDocumentClass,
} from "../utils/sheet";
import { EmokloreActorSheet } from "./actor-sheet";
import { CharSheetImportDialog } from "./charsheet-import-dialog";
import {
  BIOGRAPHY_PAIRED_COUNT,
  buildBiographyRows,
  createEmotionOptions,
  getEmotionRows,
} from "./helpers";
import type {
  BaseSkillRow,
  CharacterContext,
  CharacteristicsMap,
  EmokloreRenderOptions,
  LabeledField,
  SkillRow,
} from "./types";

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheetV2}
 */

export class EmokloreCharacterSheet extends EmokloreActorSheet {
  declare actor: EmokloreActor;

  static override DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    classes: ["standard-form", "character"],
    position: {
      width: 601,
      height: 710,
    },
    actions: {
      ...super.DEFAULT_OPTIONS.actions,
      viewDoc: this._viewDoc,
      createDoc: this._createDoc,
      deleteDoc: this._deleteDoc,
      toggleEffect: this._toggleEffect,
      importCharacter: this._importCharacter,
    },
  };

  static override PARTS = {
    header: {
      template: systemPath("templates/actor/header.hbs"),
      // 入れ子のpartialは再帰的に解決されないので、使うものをすべて並べる
      templates: [systemPath("templates/actor/partials/meter.hbs")],
    },
    // 本体のテンプレートなので systemPath は通さない
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    skills: {
      template: systemPath("templates/actor/skills-tab.hbs"),
      templates: [
        "templates/actor/skills.hbs",
        "templates/actor/base-skills.hbs",
        "templates/actor/partials/card.hbs",
        "templates/actor/partials/stat-row.hbs",
        "templates/actor/partials/skill-row-play.hbs",
        "templates/actor/partials/skill-row-edit.hbs",
      ].map(systemPath),
      scrollable: [""],
    },
    biography: {
      template: systemPath("templates/actor/biography.hbs"),
      templates: [
        "templates/actor/partials/card.hbs",
        "templates/actor/partials/stat-row.hbs",
        "templates/actor/partials/field.hbs",
      ].map(systemPath),
      scrollable: [""],
    },
    effects: {
      template: systemPath("templates/actor/effects.hbs"),
      scrollable: [""],
    },
  };

  static override TABS = {
    primary: {
      tabs: [{ id: "skills" }, { id: "biography" }, { id: "effects" }],
      labelPrefix: "EMOKLORE.CharacterSheet.tab",
      initial: "skills",
    },
  };

  override async _prepareContext(options: EmokloreRenderOptions): Promise<CharacterContext> {
    // 基底のコンテキストはドキュメント種別を問わない形なので、
    // characterシートであることが分かっているここで1回だけ絞る
    const baseContext = await super._prepareContext(options);
    const context = baseContext as CharacterContext;
    context.config = CONFIG.EMOKLORE;
    context.emotionRows = getEmotionRows(
      context.system.emotions,
      context.config.resonantEmotions,
      context.config.emotionAttributes,
    );

    context.emotionOptions = createEmotionOptions();
    return context;
  }

  override async _preparePartContext(
    partId: string,
    context: CharacterContext,
    options: EmokloreRenderOptions,
  ): Promise<CharacterContext> {
    await super._preparePartContext(partId, context, options);

    switch (partId) {
      case "skills":
        this._prepareSkillsContext(context);
        break;
      case "biography":
        await this._prepareBiographyContext(context);
        break;
      case "effects":
        this._prepareEffectsContext(context);
        break;
      default:
        // header / tabs は追加のコンテキストを必要としないので何もしない
        break;
    }

    if (partId in context.tabs) context.tab = context.tabs[partId] as unknown;
    return context;
  }

  static async _viewDoc(this: EmokloreCharacterSheet, _event: Event, target: HTMLElement) {
    getEmbeddedDocument(target, this.actor)?.sheet?.render(true);
  }

  static async _deleteDoc(this: EmokloreCharacterSheet, _event: Event, target: HTMLElement) {
    await getEmbeddedDocument(target, this.actor)?.delete();
  }

  static async _createDoc(
    this: EmokloreCharacterSheet,
    _event: Event,
    target: HTMLElement & { dataset: DOMStringMap },
  ) {
    const docData = createDocumentData(target, this.actor);
    const docCls = resolveEmbeddedDocumentClass(target.dataset.documentClass);
    await docCls.create(docData, { parent: this.actor });
  }

  static async _toggleEffect(this: EmokloreCharacterSheet, _event: Event, target: HTMLElement) {
    const effect = getEmbeddedDocument(target, this.actor);
    if (effect) await effect.update({ disabled: !effect.disabled });
  }

  static async _importCharacter(this: EmokloreCharacterSheet, event: Event, _target: HTMLElement) {
    event.preventDefault();
    console.log("Opening import dialog for actor:", this.actor);
    await CharSheetImportDialog.show(this.actor);
  }

  /**
   * 能力値の表示用データ。
   *
   * アイコンは CONFIG.EMOKLORE 側の定義なので、テンプレートで二重の lookup を
   * 組まずに済むようここで引いておく。
   */
  _getCharacteristics(): CharacteristicsMap {
    return Object.fromEntries(
      Object.entries(CONFIG.EMOKLORE.characteristics).map(([chc, { fa }]) => [
        chc,
        {
          field: this.actor.system.schema.getField(["characteristics", chc]),
          value: this.actor.system.characteristics[chc as CharacteristicKey]?.value ?? 0,
          icon: fa,
        },
      ]),
    );
  }

  /**
   * 技能の表示用データ。
   *
   * label / isExtra はアクターに保存せず CONFIG.EMOKLORE 側の定義なので、ここで合流させる。
   * 能力値ラベルも同様に引いておく。CONFIG の label は i18nInit の performPreLocalization で
   * 翻訳済みなので、テンプレート側で言語キーを組み立てる必要はない。
   */
  _getSkills(): Record<string, SkillRow> {
    return Object.fromEntries(
      Object.entries(CONFIG.EMOKLORE.skills).map(([key, { label, isExtra }]) => {
        const entry = this.actor.system.skills[key as SkillKey];
        const characteristic = CONFIG.EMOKLORE.characteristics[entry.characteristic];
        return [
          key,
          {
            field: this.actor.system.schema.getField(["skills", key]),
            label,
            isExtra: isExtra ?? false,
            level: entry.level,
            target: entry.target,
            characteristic: entry.characteristic,
            specialization: entry.specialization,
            mod: entry.mod,
            characteristicLabel: characteristic?.label ?? "",
            characteristicIcon: characteristic?.fa ?? "",
          },
        ];
      }),
    );
  }

  /**
   * 基本技能の表示用データ。
   *
   * 目標値と能力値はアクターに、表示名は CONFIG.EMOKLORE にあるので、ここで合流させる。
   */
  _getBaseSkills(): BaseSkillRow[] {
    return Object.entries(this.actor.system.baseSkills).map(
      ([key, { characteristic, target }]) => ({
        key,
        label:
          CONFIG.EMOKLORE.baseSkills[key as keyof typeof CONFIG.EMOKLORE.baseSkills]?.label ?? "",
        target,
        characteristicIcon: CONFIG.EMOKLORE.characteristics[characteristic]?.fa ?? "",
      }),
    );
  }

  private _prepareSkillsContext(context: CharacterContext): void {
    context.characteristics = this._getCharacteristics();
    context.charPointSum = calculateCharPointSum(context.characteristics);
    context.charPointMax = CHARACTERISTIC_POINT_MAX;
    context.skills = this._getSkills();
    context.skillPointSum = this._calculateSkillPointSumFromContext(context.skills);
    context.skillPointMax = SKILL_POINT_MAX;
    context.baseSkills = this._getBaseSkills();
  }

  /**
   * 経歴の表示用データ。
   *
   * 備考は system.json で htmlFields に指定しているリッチテキストなので、
   * @UUID リンクやインラインロールを解決するため描画前に enrichHTML を通す。
   */
  private async _prepareBiographyContext(context: CharacterContext): Promise<void> {
    const noteHTML = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      this.actor.system.biography.note,
      {
        secrets: this.actor.isOwner,
        relativeTo: this.actor,
        rollData: this.actor.getRollData(),
      },
    );

    // systemFields の型は DataField 止まりで fields に降りられないため、スキーマから引く。
    // fields の値も label を持つ形に補っておき、キャストを1回で済ませる
    const biography = this.actor.system.schema.getField([
      "biography",
    ]) as foundry.data.fields.SchemaField & { fields: Record<string, LabeledField> };

    const rows = buildBiographyRows(biography.fields, this.actor.system.biography, {
      note: noteHTML,
    });

    // 先頭の数件は横並びの組にするので、テンプレート側で分けて回せるよう2つに割る
    context.biographyPairedRows = rows.slice(0, BIOGRAPHY_PAIRED_COUNT);
    context.biographyRows = rows.slice(BIOGRAPHY_PAIRED_COUNT);
  }

  private _prepareEffectsContext(context: CharacterContext): void {
    context.tab = context.tabs.effects;
    context.effects = prepareActiveEffectCategories(this.actor.allApplicableEffects());
  }

  private _calculateSkillPointSumFromContext(skills: Record<string, SkillRow>): number {
    const skillsObject = Object.values(skills);
    const exSkillsObject = skillsObject.filter((skill) => skill.isExtra);
    return calculateTotalSkillPoints(skillsObject, exSkillsObject);
  }
}
