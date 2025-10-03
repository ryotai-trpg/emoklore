const {api, sheets} = foundry.applications;

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheetV2}
 */
export class EmokloreActorSheet extends api.HandlebarsApplicationMixin(
  sheets.ActorSheetV2
) {
  constructor(options = {}) {
    super(options);
    // this.#dragDrop = this.#createDragDropHandlers();
  }
  static DEFAULT_OPTIONS = {
    classes: ["standard-form", "emoklore", "actor", "character"],
    position: {
      width: 700,
      height: 800
    },
    actions: {
      roll: this.#onRoll
    },
    window: {
      resizable: true
    },
    form: {
      submitOnChange: true
    }
  };

  /** @override */
    static PARTS = {
      header: {
        template: "systems/emoklore/templates/actor/header.hbs"
      },
      tabs: {
        template: "templates/generic/tab-navigation.hbs"
      },
      stats: {
        template: "systems/emoklore/templates/actor/stats.hbs",
        scrollable: [""],
      },
      biography: {
        template: "systems/emoklore/templates/actor/biography.hbs"
      }
    };

  static TABS = {
    primary: {
      tabs: [
        { id: "stats" },
        { id: "biography"} 
      ],
      labelPrefix: "EMOKLORE.CharacterSheet.tab",
      initial: "stats",
    },
  };

  static async #onRoll(event, target) {
    event.preventDefault();
    const dataset = target.dataset

    switch (dataset.rollType) {
      case "skill":
        return this.actor.rollSkill(dataset.skill);
    }
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    Object.assign(context, {
      // owner: this.document.isOwner,
      // limited: this.document.limited,
      // gm: game.user.isGM,
      document: this.document,
      system: this.document.system,
      systemFields: this.document.system.schema.fields,
      flags: this.document.flags,
    });

    console.log(context);

    return context;
  }

  async _preparePartContext(partId, context, options) {
    await super._preparePartContext(partId, context, options);
    switch (partId) {
      case "stats":
        context.skills = this._getSkills();
        context.characteristics = this._getCharacteristics();
        context.sum_char = Object.values(context.characteristics).reduce((sum, obj) =>
          {return sum + obj.value}, 0) - context.characteristics.fortune.value

        context.skillLevelOptions = Object.entries(CONFIG.EMOKLORE.skillLevel).
          map(([value, { label }]) => 
            ({ value, label })
          )
        break;

      case "biography":
        context.emotionOptions = Object.entries(CONFIG.EMOKLORE.sympatheticEmotion).
          map(([value, { label, attribute }]) => 
            ({ value, label, group: game.i18n.localize(`EMOKLORE.emotionAttributes.${attribute}`)})
          )
        break
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
        value: value ?? 0
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
        ...value
      };
      return obj;
    }, {});
  }

  _getBaseSkills() {
    // const isPlay = this.isPlayMode;
    // const data = isPlay ? this.actor : this.actor._source;
    const data = this.actor;
    console.log(this.actor.system)
    return Object.keys(CONFIG.EMOKLORE.baseSkills).reduce((obj, baseSkill) => {
      const value = foundry.utils.getProperty(data, `system.baseSkills.${baseSkill}`);
      console.log(value);
      obj[baseSkill] = {
        label: value.label ?? "Null",
        level: value.level ?? 0
      };
      return obj;
    }, {});
  }

}
