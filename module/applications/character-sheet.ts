import type { CharacteristicKey } from "../config/characteristics";
import { systemPath } from "../constants";
import type { EmokloreActor } from "../documents/actor";
import { calculateCharPointSum, calculateTotalSkillPoints } from "../rules/character-points";
import { prepareActiveEffectCategories } from "../utils/effects";
import {
  createDocumentData,
  getEmbeddedDocument,
  resolveEmbeddedDocumentClass,
} from "../utils/sheet";
import { EmokloreActorSheet } from "./actor-sheet";
import { CharSheetImportDialog } from "./charsheet-import-dialog";
import { createEmotionOptions, createSkillLevelOptions, getEmotionAttributes } from "./helpers";
import type {
  CharacterContext,
  CharacteristicsMap,
  EmokloreRenderOptions,
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
      template: "systems/emoklore/templates/actor/header.hbs",
    },
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    skills: {
      template: "systems/emoklore/templates/actor/stats.hbs", // TODO: reaname
      templates: ["card-view.hbs", "card-edit.hbs", "skills.hbs", "base-skills.hbs"].map((t) =>
        systemPath(`templates/actor/${t}`),
      ),
      scrollable: [""],
    },
    biography: {
      template: "systems/emoklore/templates/actor/biography.hbs",
      templates: ["systems/emoklore/templates/actor/card-view.hbs"],
      scrollable: [""],
    },
    effects: {
      template: "systems/emoklore/templates/actor/effects.hbs",
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
    const context = baseContext as unknown as CharacterContext;
    context.config = CONFIG.EMOKLORE;
    context.emotionAttributes = getEmotionAttributes(
      context.system.emotions,
      context.config.resonantEmotions,
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
        this._prepareBiographyContext(context);
        break;
      case "effects":
        this._prepareEffectsContext(context);
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

  _getCharacteristics(): Record<string, unknown> {
    const data = this.actor;
    return Object.keys(CONFIG.EMOKLORE.characteristics).reduce(
      (obj, chc) => {
        const value = foundry.utils.getProperty(data, `system.characteristics.${chc}.value`);
        (obj as Record<string, unknown>)[chc] = {
          field: this.actor.system.schema.getField(["characteristics", chc]),
          value: value ?? 0,
        };
        return obj;
      },
      {} as Record<string, unknown>,
    );
  }

  /**
   * 技能の表示用データ。
   *
   * label / isExtra はアクターに保存せず CONFIG.EMOKLORE 側の定義なので、ここで合流させる。
   * 能力値ラベルも同様に引いておく。CONFIG の label は i18nInit の performPreLocalization で
   * 翻訳済みなので、テンプレート側で言語キーを組み立てる必要はない。
   */
  _getSkills(): Record<string, unknown> {
    const data = this.actor;
    return Object.entries(CONFIG.EMOKLORE.skills).reduce(
      (obj, [key, { label, isExtra }]) => {
        const value = foundry.utils.getProperty(data, `system.skills.${key}`) as
          | Record<string, unknown>
          | undefined;
        const characteristic = value?.characteristic as CharacteristicKey | undefined;
        (obj as Record<string, unknown>)[key] = {
          field: this.actor.system.schema.getField(["skills", key]),
          label,
          isExtra: isExtra ?? false,
          ...(value ?? {}),
          // spreadより後に置く。保存値には characteristicLabel がないので上書きされないが、
          // 順序を変えると壊れる
          characteristicLabel: characteristic
            ? (CONFIG.EMOKLORE.characteristics[characteristic]?.label ?? "")
            : "",
        };
        return obj;
      },
      {} as Record<string, unknown>,
    );
  }

  private _prepareSkillsContext(context: CharacterContext): void {
    context.characteristics = this._getCharacteristics() as unknown as CharacteristicsMap;
    context.charPointSum = calculateCharPointSum(context.characteristics);
    context.skills = this._getSkills() as unknown as Record<string, SkillRow>;
    context.skillPointSum = this._calculateSkillPointSumFromContext(context.skills);
    context.skillLevelOptions = createSkillLevelOptions();
  }

  private _prepareBiographyContext(_context: CharacterContext): void {
    // Add biography-specific processing here if needed
  }

  private _prepareEffectsContext(context: CharacterContext): void {
    context.tab = context.tabs.effects;
    context.effects = prepareActiveEffectCategories(this.actor.allApplicableEffects());
  }

  private _calculateSkillPointSumFromContext(skills: Record<string, SkillRow>): number {
    const skillsObject = Object.values(skills) as Array<{ level: number; isExtra?: boolean }>;
    const exSkillsObject = skillsObject.filter((skill) => skill.isExtra);
    return calculateTotalSkillPoints(skillsObject, exSkillsObject);
  }
}
