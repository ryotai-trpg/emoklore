import EmokloreDocumentSheetMixin from "./document-sheet-mixin";

export class EmokloreActorSheet extends EmokloreDocumentSheetMixin(
  foundry.applications.sheets.ActorSheetV2,
) {

  static DEFAULT_OPTIONS = {
    classes: ["actor"],
    actions: {
      roll: this.#onRoll,
      increaseResources: this.#onIncreaseResources,
      decreaseResources: this.#onDecreaseResources,
    },
  };

  static async #onIncreaseResources(event, target) {
    event.preventDefault();
    const dataset = target.dataset;
    return this.actor.adjustResource(dataset.type, 1);
  }

  static async #onDecreaseResources(event, target) {
    event.preventDefault();
    const dataset = target.dataset;
    return this.actor.adjustResource(dataset.type, -1);
  }

  static async #onRoll(event, target) {
    event.preventDefault();
    const dataset = target.dataset;

    switch (dataset.rollType) {
      case "skill":
        return this.actor.rollSkill(dataset.skill);
      case "base-skill":
        return this.actor.rollSkill(dataset.skill, { base: true });
      case "resonance":
        return this.actor.rollResonance();
    }
  }
}
