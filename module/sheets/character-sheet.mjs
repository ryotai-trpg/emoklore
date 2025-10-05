import { EmokloreActorSheet } from "./actor-sheet.mjs";
import { systemPath } from "../constants.mjs";

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheetV2}
 */

export class EmokloreCharacterSheet extends EmokloreActorSheet {
  static DEFAULT_OPTIONS = {
    classes: ["standard-form", "character"],
    position: {
      width: 700,
      height: 800,
    },
  };

  /** @override */
  static PARTS = {
    header: { template: "systems/emoklore/templates/actor/header.hbs" },
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    stats: {
      template: "systems/emoklore/templates/actor/stats.hbs",
      templates: [ "characteristics.hbs", "skills.hbs", "base-skills.hbs" ].map(t => systemPath(`templates/actor/${t}`)),
      scrollable: [""],
    },
    biography: {
      template: "systems/emoklore/templates/actor/biography.hbs",
      scrollable: [""],
    },
  };

  static TABS = {
    primary: {
      tabs: [{ id: "stats" }, { id: "biography" }],
      labelPrefix: "EMOKLORE.CharacterSheet.tab",
      initial: "stats",
    },
  };

  async _preparePartContext(partId, context, options) {
    await super._preparePartContext(partId, context, options);
    switch (partId) {
      case "stats":
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
    }

    if (partId in context.tabs) context.tab = context.tabs[partId];
    return context;
  }

  _getCharacteristics() {
    // const isPlay = this.isPlayMode;
    // const data = isPlay ? this.actor : this.actor._source;
    const data = this.actor;
    return Object.keys(CONFIG.EMOKLORE.characteristics).reduce((obj, chc) => {
      const value = foundry.utils.getProperty(data, `system.characteristics.${chc}`);
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
    console.log(this.actor.system);
    return Object.keys(CONFIG.EMOKLORE.baseSkills).reduce((obj, baseSkill) => {
      const value = foundry.utils.getProperty(data, `system.baseSkills.${baseSkill}`);
      console.log(value);
      obj[baseSkill] = {
        label: value.label ?? "Null",
        level: value.level ?? 0,
      };
      return obj;
    }, {});
  }
}
