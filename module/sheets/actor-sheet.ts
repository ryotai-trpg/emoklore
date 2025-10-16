import EmokloreDocumentSheetMixin from "./document-sheet-mixin";
import type { EmokloreActor } from "../documents/actor";

export class EmokloreActorSheet extends EmokloreDocumentSheetMixin(
  foundry.applications.sheets.ActorSheetV2,
) {
  declare actor: EmokloreActor;

  static override DEFAULT_OPTIONS = {
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

  static async #onIncreaseResources(event: Event, target: HTMLElement) {
    event.preventDefault();
    const dataset = (target as HTMLElement & { dataset: DOMStringMap }).dataset;
    return (this as any).actor.adjustResource(dataset.type as "hp" | "mp" | "resonance", 1);
  }

  static async #onDecreaseResources(event: Event, target: HTMLElement) {
    event.preventDefault();
    const dataset = (target as HTMLElement & { dataset: DOMStringMap }).dataset;
    return (this as any).actor.adjustResource(dataset.type as "hp" | "mp" | "resonance", -1);
  }

  static async #onRoll(event: Event, target: HTMLElement) {
    event.preventDefault();
    const dataset = (target as HTMLElement & { dataset: DOMStringMap }).dataset;

    switch (dataset.rollType) {
      case "skill":
        return (this as any).actor.rollSkill(dataset.skill);
      case "base-skill":
        return (this as any).actor.rollSkill(dataset.skill, { base: true });
      case "resonance":
        return (this as any).actor.rollResonance();
    }
  }

  static async #toggleMode(event: Event, target: HTMLElement): Promise<void> {
    if (!(this as any).isEditable) {
      console.error("You can't switch to Edit mode if the sheet is uneditable");
      return;
    }
    (this as any)._mode = (this as any).isPlayMode
      ? (this.constructor as any).MODES.EDIT
      : (this.constructor as any).MODES.PLAY;
    (this as any).render();
  }
}
