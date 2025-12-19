import { EmokloreActorSheet } from "./actor-sheet";
import { systemPath } from "../constants";
import { prepareActiveEffectCategories } from "../helpers/effects";
import type { CharacterDataModel } from "../data/character";
import type { EmokloreActor } from "../documents/actor";
import type {
  EmotionKey,
  SkillRow,
  CharacteristicsMap,
  CharacterContext,
  EmokloreCharacterSheetActions,
} from "./types";
import {
  calculateCharPointSum,
  calculateTotalSkillPoints,
  createSkillLevelOptions,
  createEmotionOptions,
  getEmotionAttributes,
  getEmbeddedDocument,
  createDocumentData,
} from "./helpers";
import { CharSheetImportDialog } from "./charsheet-import-dialog";

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

  static PARTS = {
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
    items: {
      template: "systems/emoklore/templates/actor/items.hbs",
      scrollable: [""],
    },
    effects: {
      template: "systems/emoklore/templates/actor/effects.hbs",
      scrollable: [""],
    },
  };

  static TABS = {
    primary: {
      tabs: [{ id: "skills" }, { id: "biography" }, { id: "items" }, { id: "effects" }],
      labelPrefix: "EMOKLORE.CharacterSheet.tab",
      initial: "skills",
    },
  };

  override async _prepareContext(options: Record<string, unknown>): Promise<CharacterContext> {
    const baseContext = await super._prepareContext(options);
    const context = baseContext as CharacterContext;
    context.config = CONFIG.EMOKLORE;
    context.emotionAttributes = getEmotionAttributes(
      context.system.emotions,
      context.config.resonantEmotions,
    );

    context.emotionOptions = createEmotionOptions();
    return context;
  }

  async _preparePartContext(
    partId: string,
    context: CharacterContext,
    options: Record<string, unknown>,
  ): Promise<CharacterContext> {
    await super._preparePartContext(partId, context, options);

    switch (partId) {
      case "skills":
        this._prepareSkillsContext(context);
        break;
      case "biography":
        this._prepareBiographyContext(context);
        break;
      case "items":
        this._prepareItemsContext(context);
        break;
      case "effects":
        this._prepareEffectsContext(context);
        break;
    }

    if (partId in context.tabs) context.tab = context.tabs[partId] as unknown;
    return context;
  }

  static async _viewDoc(this: EmokloreCharacterSheet, event: Event, target: HTMLElement) {
    const doc = getEmbeddedDocument(target, this.actor);
    if (doc && "sheet" in doc && doc.sheet) {
      (doc.sheet as any).render(true);
    }
  }

  static async _deleteDoc(this: EmokloreCharacterSheet, event: Event, target: HTMLElement) {
    const doc = getEmbeddedDocument(target, this.actor);
    if (doc && "delete" in doc) {
      await (doc as any).delete();
    }
  }

  static async _createDoc(
    this: EmokloreCharacterSheet,
    event: Event,
    target: HTMLElement & { dataset: DOMStringMap },
  ) {
    const docData = createDocumentData(target, this.actor);
    const docCls = getDocumentClass(target.dataset.documentClass! as any) as any;
    await docCls.create(docData, { parent: this.actor });
  }

  static async _toggleEffect(this: EmokloreCharacterSheet, event: Event, target: HTMLElement) {
    const effect = getEmbeddedDocument(target, this.actor);
    if (effect && "update" in effect && "disabled" in effect) {
      await (effect as any).update({ disabled: !(effect as any).disabled });
    }
  }

  static async _importCharacter(this: EmokloreCharacterSheet, event: Event, target: HTMLElement) {
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

  _getSkills(): Record<string, unknown> {
    const data = this.actor;
    return Object.keys(CONFIG.EMOKLORE.skills).reduce(
      (obj, chc) => {
        const value = foundry.utils.getProperty(data, `system.skills.${chc}`) as
          | Record<string, unknown>
          | undefined;
        (obj as Record<string, unknown>)[chc] = {
          field: this.actor.system.schema.getField(["skills", chc]),
          ...(value ?? {}),
        };
        return obj;
      },
      {} as Record<string, unknown>,
    );
  }

  _getBaseSkills(): Record<string, unknown> {
    const data = this.actor;
    return Object.keys(CONFIG.EMOKLORE.baseSkills).reduce(
      (obj, baseSkill) => {
        const value = foundry.utils.getProperty(data, `system.baseSkills.${baseSkill}`) as Record<
          string,
          unknown
        >;
        (obj as Record<string, unknown>)[baseSkill] = {
          label: value.label ?? "Null",
          level: value.level ?? 0,
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

  private _prepareBiographyContext(context: CharacterContext): void {
    // Add biography-specific processing here if needed
  }

  private _prepareItemsContext(context: CharacterContext): void {
    context.tab = context.tabs.items;
    console.log(this.actor.itemTypes.weapon);
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
