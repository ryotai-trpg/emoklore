import { isBaseSkillKey } from "../config/base-skills";
import { isSkillKey } from "../config/skills";
import type { SkillRef } from "../data/character-like";
import type { EmokloreActor } from "../documents/actor";
import { getSetting } from "../settings";
import EmokloreDocumentSheetMixin from "./document-sheet-mixin";
import { requestResonanceRoll, requestSkillRoll } from "./rolls";
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
    // as SkillKey と名乗るだけでは綴り間違いが素通りし、CONFIG を引いた先の
    // 分割代入で TypeError になる
    const skill = dataset.skill ?? "";

    // 既定は「素のクリックで即ロール、修飾キー付きで尋ねる」。ほとんどの判定に修正は
    // 付かないので、毎回ダイアログを挟むと手数が増えるだけになる。毎回尋ねたい人は
    // 設定で切り替えられる（手元の好みなので client スコープ）
    const withOptions =
      getSetting("skillRollDialog") === "always" || (event instanceof MouseEvent && event.shiftKey);
    const roll = (ref: SkillRef) =>
      withOptions ? requestSkillRoll(this.actor, ref) : this.actor.rollSkill(ref);

    switch (dataset.rollType) {
      case "skill":
        if (!isSkillKey(skill)) return undefined;
        return roll({ kind: "skill", key: skill });
      case "base-skill":
        if (!isBaseSkillKey(skill)) return undefined;
        return roll({ kind: "base", key: skill });
      case "custom-skill": {
        // 固定表が無いので綴りは確かめようがない。判定が読むのはアクター側のミラーなので、
        // アイテムではなくそちらに居ることを確かめる（消した直後のクリックはここで止まる）。
        // カスタム技能を持つのは能力値＋技能を持つ種別だけ
        const id = dataset.itemId ?? "";
        if (!this.actor.isCharacterLike() || !(id in this.actor.system.customSkills)) {
          return undefined;
        }
        return roll({ kind: "custom", id });
      }
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
