import { EmokloreActorSheet } from "./actor-sheet.mjs";
import { systemPath } from "../constants.mjs";
import { prepareActiveEffectCategories } from "../helpers/effects.mjs";

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheetV2}
 */

export class EmokloreCharacterSheet extends EmokloreActorSheet {
  static DEFAULT_OPTIONS = {
    classes: ["standard-form", "character"],
    position: {
      width: 620,
      height: 730,
    },
    actions: {
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

  async _preparePartContext(partId, context, options) {
    await super._preparePartContext(partId, context, options);
    switch (partId) {
      case "skills":
        context.skills = this._getSkills();
        context.characteristics = this._getCharacteristics();
        context.sum_char =
          Object.values(context.characteristics).reduce((sum, obj) => {
            return sum + obj.value;
          }, 0) - context.characteristics.fortune.value;

        context.skillLevelOptions = Object.entries(CONFIG.EMOKLORE.skillLevel).map(
          ([value, { label }]) => ({
            value,
            label,
          }),
        );
        context.emotionOptions = Object.entries(CONFIG.EMOKLORE.sympatheticEmotion).map(
          ([value, { label, attribute }]) => ({
            value,
            label,
            group: game.i18n.localize(`EMOKLORE.emotionAttributes.${attribute}`),
          }),
        );
        context.config = CONFIG.EMOKLORE;
        break;

      case "biography":
        context.emotionOptions = Object.entries(CONFIG.EMOKLORE.sympatheticEmotion).map(
          ([value, { label, attribute }]) => ({
            value,
            label,
            group: game.i18n.localize(`EMOKLORE.emotionAttributes.${attribute}`),
          }),
        );
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

    if (partId in context.tabs) context.tab = context.tabs[partId];
    return context;
  }

  static async _viewDoc(event, target) {
    const doc = this._getEmbeddedDocument(target);
    doc.sheet.render(true);
  }

  static async _deleteDoc(event, target) {
    const doc = this._getEmbeddedDocument(target);
    await doc.delete();
  }

  static async _createDoc(event, target) {
    // Retrieve the configured document class for Item or ActiveEffect
    const docCls = getDocumentClass(target.dataset.documentClass);
    // Prepare the document creation data by initializing it a default name.
    const docData = {
      name: docCls.defaultName({
        // defaultName handles an undefined type gracefully
        type: target.dataset.type,
        parent: this.actor,
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

  static async _toggleEffect(event, target) {
    const effect = this._getEmbeddedDocument(target);
    await effect.update({ disabled: !effect.disabled });
  }

  _getEmbeddedDocument(target) {
    const docRow = target.closest("li[data-document-class]");
    if (docRow.dataset.documentClass === "Item") {
      return this.actor.items.get(docRow.dataset.itemId);
    } else if (docRow.dataset.documentClass === "ActiveEffect") {
      const parent =
        docRow.dataset.parentId === this.actor.id
          ? this.actor
          : this.actor.items.get(docRow?.dataset.parentId);
      return parent.effects.get(docRow?.dataset.effectId);
    } else return console.warn("Could not find document class");
  }

  _getCharacteristics() {
    // const isPlay = this.isPlayMode;
    // const data = isPlay ? this.actor : this.actor._source;
    const data = this.actor;
    return Object.keys(CONFIG.EMOKLORE.characteristics).reduce((obj, chc) => {
      const value = foundry.utils.getProperty(data, `system.characteristics.${chc}.value`);
      obj[chc] = {
        field: this.actor.system.schema.getField(["characteristics", chc]),
        value: value ?? 0,
      };
      return obj;
    }, {});
  }

  _getSkills() {
    // const isPlay = this.isPlayMode;
    // const data = isPlay ? this.actor : this.actor._source;
    const data = this.actor;
    return Object.keys(CONFIG.EMOKLORE.skills).reduce((obj, chc) => {
      const value = foundry.utils.getProperty(data, `system.skills.${chc}`);
      obj[chc] = {
        field: this.actor.system.schema.getField(["skills", chc]),
        ...value,
      };
      return obj;
    }, {});
  }

  _getBaseSkills() {
    // const isPlay = this.isPlayMode;
    // const data = isPlay ? this.actor : this.actor._source;
    const data = this.actor;
    return Object.keys(CONFIG.EMOKLORE.baseSkills).reduce((obj, baseSkill) => {
      const value = foundry.utils.getProperty(data, `system.baseSkills.${baseSkill}`);
      obj[baseSkill] = {
        label: value.label ?? "Null",
        level: value.level ?? 0,
      };
      return obj;
    }, {});
  }
}
