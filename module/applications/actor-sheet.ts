import { isBaseSkillKey } from "../config/base-skills";
import { isSkillKey } from "../config/skills";
import type { EmokloreActor } from "../documents/actor";
import EmokloreDocumentSheetMixin from "./document-sheet-mixin";
import { requestResonanceRoll } from "./rolls";
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

    // dataset は生の文字列なので、技能キーとして通ることをここで確かめる。
    // テンプレートの綴り間違いは、以前は as SkillKey をすり抜けて
    // CONFIG を引いた先の分割代入で TypeError になっていた
    const skill = dataset.skill ?? "";

    switch (dataset.rollType) {
      case "skill":
        if (!isSkillKey(skill)) return undefined;
        return this.actor.rollSkill({ kind: "skill", key: skill });
      case "base-skill":
        if (!isBaseSkillKey(skill)) return undefined;
        return this.actor.rollSkill({ kind: "base", key: skill });
      case "resonance":
        // 強度と一致度をダイアログで尋ねてから振る
        return requestResonanceRoll(this.actor);
      case "weapon":
        // 判定はここでは振らない。チャットに武器カードを置き、そのボタンから振らせる
        return this.actor.items.get(dataset.itemId!)?.use();
      default:
        // 未知の data-roll-type は何もしない。テンプレート側の記述ミスなので、
        // ここで握り潰していること自体は別途見直す余地がある
        return undefined;
    }
  }
}
