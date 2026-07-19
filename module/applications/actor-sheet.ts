import type { EmokloreActor } from "../documents/actor";
import EmokloreDocumentSheetMixin from "./document-sheet-mixin";
import type { EmokloreActorSheetOptions } from "./types";

export class EmokloreActorSheet extends EmokloreDocumentSheetMixin(
  foundry.applications.sheets.ActorSheetV2,
) {
  declare actor: EmokloreActor;

  // toggleMode / window / form は mixin 側の DEFAULT_OPTIONS が継承チェーン経由で
  // マージされるため、ここでは宣言しない
  static override DEFAULT_OPTIONS: EmokloreActorSheetOptions = {
    classes: ["actor"],
    actions: {
      roll: this.#onRoll,
    },
  };

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
}
