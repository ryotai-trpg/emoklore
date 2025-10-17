import EmokloreDocumentSheetMixin from "./document-sheet-mixin";
import type { EmokloreActor } from "../documents/actor";
import type { EmokloreActorSheetActions, EmokloreActorSheetOptions } from "./types";

export class EmokloreActorSheet extends EmokloreDocumentSheetMixin(
  foundry.applications.sheets.ActorSheetV2,
) {
  declare actor: EmokloreActor;

  static override DEFAULT_OPTIONS: EmokloreActorSheetOptions = {
    classes: ["actor"],
    actions: {
      roll: this.#onRoll,
      increaseResources: this.#onIncreaseResources,
      decreaseResources: this.#onDecreaseResources,
      toggleMode: this.#toggleMode,
    },
    window: {
      resizable: true,
    },
    form: {
      submitOnChange: true,
    },
  };

  static async #onIncreaseResources(this: EmokloreActorSheet, event: Event, target: HTMLElement) {
    event.preventDefault();
    const dataset = (target as HTMLElement & { dataset: DOMStringMap }).dataset;
    return this.actor.adjustResource(dataset.type as "hp" | "mp" | "resonance", 1);
  }

  static async #onDecreaseResources(this: EmokloreActorSheet, event: Event, target: HTMLElement) {
    event.preventDefault();
    const dataset = (target as HTMLElement & { dataset: DOMStringMap }).dataset;
    return this.actor.adjustResource(dataset.type as "hp" | "mp" | "resonance", -1);
  }

  static async #onRoll(this: EmokloreActorSheet, event: Event, target: HTMLElement) {
    event.preventDefault();
    const dataset = (target as HTMLElement & { dataset: DOMStringMap }).dataset;

    switch (dataset.rollType) {
      case "skill":
        return this.actor.rollSkill(dataset.skill!);
      case "base-skill":
        return this.actor.rollSkill(dataset.skill!, { base: true });
      case "resonance":
        return this.actor.rollResonance();
    }
  }

  static async #toggleMode(
    this: EmokloreActorSheet,
    event: Event,
    target: HTMLElement,
  ): Promise<void> {
    if (!this.isEditable) {
      console.error("You can't switch to Edit mode if the sheet is uneditable");
      return;
    }
    this._mode = this.isPlayMode
      ? (this.constructor as any).MODES.EDIT
      : (this.constructor as any).MODES.PLAY;
    this.render();
  }
}
