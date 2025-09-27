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
    classes: ["emoklore", "actor", "character"],
    position: {
      width: 600,
      height: 700
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
        template: "systems/emoklore/templates/actor/stats.hbs"
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
}
