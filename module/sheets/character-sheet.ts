import { EmokloreActorSheet } from "./actor-sheet";
import { systemPath } from "../constants";
import { prepareActiveEffectCategories } from "../helpers/effects";
import type { CharacterDataModel } from "../data/character";
import type { EmokloreActor } from "../documents/actor";

type EmotionKey = "surface" | "hidden" | "root";

type SkillRow = {
  level: number;
  isExtra?: boolean;
  [key: string]: unknown;
};

type CharacteristicsMap = Record<string, { field: foundry.data.fields.DataField; value: number }>;

type CharacterContext = Record<string, any> & {
  config: typeof CONFIG.EMOKLORE;
  system: CharacterDataModel;
  emotionAttributes: Record<EmotionKey, string>;
  emotionOptions: Array<{ value: string; label: string; group: string }>;
  characteristics?: CharacteristicsMap;
  charPointSum?: number;
  skills?: Record<string, SkillRow>;
  skillPointSum?: number;
  skillLevelOptions?: Array<{ value: string; label: string }>;
  tabs: Record<string, unknown>;
  tab?: unknown;
  // DocumentSheetContext properties
  isPlay: boolean;
  owner: boolean;
  limited: boolean;
  gm: boolean;
  document: EmokloreActor;
  systemFields: Record<string, foundry.data.fields.DataField>;
  flags: Record<string, unknown>;
};

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
    },
  };

  /** @override */
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
    effects: {
      template: "systems/emoklore/templates/actor/effects.hbs",
      scrollable: [""],
    },
  };

  static TABS = {
    primary: {
      tabs: [{ id: "skills" }, { id: "biography" }, { id: "effects" }],
      labelPrefix: "EMOKLORE.CharacterSheet.tab",
      initial: "skills",
    },
  };

  override async _prepareContext(options: Record<string, unknown>): Promise<CharacterContext> {
    const baseContext = await super._prepareContext(options);
    const context = baseContext as CharacterContext;
    context.config = CONFIG.EMOKLORE;
    context.emotionAttributes = {} as Record<EmotionKey, string>;

    const { resonantEmotions } = context.config;
    const { emotions } = context.system;

    for (const key of ["surface", "hidden", "root"]) {
      const emotionKey = emotions[key];
      const attr = resonantEmotions[emotionKey]?.attribute ?? "";
      context.emotionAttributes[key] = `EMOKLORE.emotionAttributes.${String(attr)}`;
    }

    context.emotionOptions = Object.entries(CONFIG.EMOKLORE.resonantEmotions).map(
      ([value, { label, attribute }]) => ({
        value: String(value),
        label: game.i18n.format("EMOKLORE.resonantEmotion", {
          emotion: label,
          attribute: game.i18n.format(`EMOKLORE.emotionAttributes.${String(attribute)}`),
        }),
        group: game.i18n.localize(`EMOKLORE.emotionAttributes.${String(attribute)}`),
      }),
    );
    return context;
  }

  async _preparePartContext(partId: string, context: CharacterContext, options: Record<string, unknown>): Promise<CharacterContext> {
    await super._preparePartContext(partId, context, options);
    switch (partId) {
      case "skills":
        context.characteristics = this._getCharacteristics() as unknown as CharacteristicsMap;
        context.charPointSum =
          Object.values(context.characteristics as Record<string, { value: number }>).reduce((sum, obj) => {
            return sum + obj.value;
          }, 0) - context.characteristics.fortune.value;

        context.skills = this._getSkills() as unknown as Record<string, SkillRow>;

        const skillsObject = Object.values(context.skills) as Array<{ level: number; isExtra?: boolean }>;
        const exSkillsObject = skillsObject.filter((skill) => skill.isExtra);

        context.skillPointSum =
          skillsObject.filter((skill) => skill.level == 1).length * 1 +
          skillsObject.filter((skill) => skill.level == 2).length * 5 +
          skillsObject.filter((skill) => skill.level == 3).length * 15 +
          exSkillsObject.filter((skill) => skill.level == 1).length * 1 +
          exSkillsObject.filter((skill) => skill.level == 2).length * 5 +
          exSkillsObject.filter((skill) => skill.level == 3).length * 15;

        context.skillLevelOptions = Object.entries(CONFIG.EMOKLORE.skillLevel).map(
          ([value, { label }]) => ({
            value,
            label,
          }),
        );

        break;

      case "biography":
        break;

      case "effects":
        context.tab = context.tabs[partId];
        // Prepare active effects
        context.effects = prepareActiveEffectCategories(
          // A generator that returns all effects stored on the actor
          // as well as any items
          this.actor.allApplicableEffects(),
        );
        break;
    }

    if (partId in context.tabs) context.tab = context.tabs[partId] as unknown;
    return context;
  }

  static async _viewDoc(this: EmokloreCharacterSheet, event: Event, target: HTMLElement) {
    const doc = this._getEmbeddedDocument(target);
    (doc as any).sheet.render(true);
  }

  static async _deleteDoc(this: EmokloreCharacterSheet, event: Event, target: HTMLElement) {
    const doc = this._getEmbeddedDocument(target);
    await (doc as any).delete();
  }

  static async _createDoc(this: EmokloreCharacterSheet, event: Event, target: HTMLElement & { dataset: DOMStringMap }) {
    // Retrieve the configured document class for Item or ActiveEffect
    const docCls = getDocumentClass(target.dataset.documentClass as any) as any;
    // Prepare the document creation data by initializing it a default name.
    const docData = {
      name: docCls.defaultName({
        // defaultName handles an undefined type gracefully
        type: target.dataset.type as any,
        parent: this.actor as any,
      }),
    };
    // Loop through the dataset and add it to our docData
    for (const [dataKey, value] of Object.entries(target.dataset)) {
      // These data attributes are reserved for the action handling
      if (["action", "documentClass"].includes(dataKey)) continue;
      // Nested properties require dot notation in the HTML, e.g. anything with `system`
      // An example exists in spells.hbs, with `data-system.spell-level`
      // which turns into the dataKey 'system.spellLevel'
      foundry.utils.setProperty(docData, dataKey, value);
    }

    // Finally, create the embedded document!
    await docCls.create(docData, { parent: this.actor });
  }

  static async _toggleEffect(this: EmokloreCharacterSheet, event: Event, target: HTMLElement) {
    const effect = this._getEmbeddedDocument(target);
    await (effect as any).update({ disabled: !(effect as any).disabled });
  }

  _getEmbeddedDocument(target: HTMLElement): any {
    const docRow = target.closest("li[data-document-class]") as HTMLElement & { dataset: DOMStringMap };
    if (docRow.dataset.documentClass === "Item") {
      return (this.actor as any).items.get(docRow.dataset.itemId!);
    } else if (docRow.dataset.documentClass === "ActiveEffect") {
      const parent =
        docRow.dataset.parentId === (this.actor as any).id
          ? this.actor
          : (this.actor as any).items.get(docRow?.dataset.parentId!);
      return (parent as any)!.effects.get(docRow?.dataset.effectId!);
    } else return console.warn("Could not find document class");
  }

  _getCharacteristics(): Record<string, unknown> {
    const data = this.actor;
    return Object.keys(CONFIG.EMOKLORE.characteristics).reduce((obj, chc) => {
      const value = foundry.utils.getProperty(data, `system.characteristics.${chc}.value`);
      (obj as Record<string, unknown>)[chc] = {
        field: (this.actor as any).system.schema.getField(["characteristics", chc]),
        value: value ?? 0,
      };
      return obj;
    }, {} as Record<string, unknown>);
  }

  _getSkills(): Record<string, unknown> {
    const data = this.actor;
    return Object.keys(CONFIG.EMOKLORE.skills).reduce((obj, chc) => {
      const value = foundry.utils.getProperty(
        data,
        `system.skills.${chc}`
      ) as Record<string, unknown> | undefined;
      (obj as Record<string, unknown>)[chc] = {
        field: (this.actor as any).system.schema.getField(["skills", chc]),
        ...(value ?? {}),
      };
      return obj;
    }, {} as Record<string, unknown>);
  }

  _getBaseSkills(): Record<string, unknown> {
    const data = this.actor;
    return Object.keys(CONFIG.EMOKLORE.baseSkills).reduce((obj, baseSkill) => {
      const value = foundry.utils.getProperty(data, `system.baseSkills.${baseSkill}`) as Record<string, unknown>;
      (obj as Record<string, unknown>)[baseSkill] = {
        label: value.label ?? "Null",
        level: value.level ?? 0,
      };
      return obj;
    }, {} as Record<string, unknown>);
  }
}
