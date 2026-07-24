import { systemPath } from "../constants";
import type { KaiAttack, KaiDataModel } from "../data/kai";
import type { EmokloreActor } from "../documents/actor";
import { enrichDocumentHTML } from "../utils/sheet";
import { resolveTargetActors } from "../utils/targets";
import { EmokloreActorSheet } from "./actor-sheet";
import { createEmotionOptions } from "./helpers";
import { requestResonanceRoll } from "./rolls";
import type { EmokloreRenderOptions } from "./types";

/** 攻撃を1件足すときの既定値。スキーマの initial と揃える */
const DEFAULT_ATTACK: KaiAttack = {
  name: "",
  diceCount: 1,
  target: 7,
  damage: "",
  mpCost: 0,
  judgeless: false,
  fixedSuccess: 1,
};

/**
 * 怪異のシート。
 *
 * HP/装甲/MP・固定イニシアチブ・共鳴感情・共鳴判定のプリセット・共鳴表参照・憑依変異・
 * 攻撃リストを持つ。攻撃はカードに出して振り、共鳴プリセットからは対象の共鳴者に共鳴判定を
 * 要求する（#75 で全共鳴者への要求カードに置き換わるまでの暫定）。
 */
export class EmokloreKaiSheet extends EmokloreActorSheet {
  // type: "kai" にしか登録しないので actor は怪異に絞れる
  declare actor: EmokloreActor & { system: KaiDataModel };

  static override DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    classes: ["standard-form", "kai"],
    position: { width: 500, height: 680 },
    actions: {
      ...super.DEFAULT_OPTIONS.actions,
      rollAttack: this._rollAttack,
      addAttack: this._addAttack,
      deleteAttack: this._deleteAttack,
      requestResonance: this._requestResonance,
    },
  };

  static override PARTS = {
    main: {
      template: systemPath("templates/actor/kai-sheet.hbs"),
      scrollable: [""],
    },
  };

  override async _prepareContext(options: EmokloreRenderOptions): Promise<KaiSheetContext> {
    const context = (await super._prepareContext(options)) as KaiSheetContext;
    const system = this.actor.system;

    const selected = new Set<string>(system.emotions);
    const options_ = createEmotionOptions();
    context.emotionOptions = options_.map((option) => ({
      ...option,
      selected: selected.has(option.value),
    }));
    context.selectedEmotions = options_.filter((option) => selected.has(option.value));

    context.mutationHTML = await enrichDocumentHTML(this.actor, system.mutation);
    context.resonanceTableLink = system.resonanceTable
      ? await enrichDocumentHTML(this.actor, `@UUID[${system.resonanceTable}]`)
      : "";

    return context;
  }

  /** 攻撃の行から index を読む。判定・削除で共通 */
  static #attackIndex(target: HTMLElement): number | null {
    const raw = target.closest<HTMLElement>("[data-attack-index]")?.dataset.attackIndex;
    const index = Number(raw);
    return Number.isInteger(index) ? index : null;
  }

  static async _rollAttack(this: EmokloreKaiSheet, _event: Event, target: HTMLElement) {
    const index = EmokloreKaiSheet.#attackIndex(target);
    if (index === null) return;
    await this.actor.rollKaiAttack(index);
  }

  static async _addAttack(this: EmokloreKaiSheet) {
    await this.actor.update({
      "system.attacks": [...this.actor.system.attacks, { ...DEFAULT_ATTACK }],
    });
  }

  static async _deleteAttack(this: EmokloreKaiSheet, _event: Event, target: HTMLElement) {
    const index = EmokloreKaiSheet.#attackIndex(target);
    if (index === null) return;
    await this.actor.update({
      "system.attacks": this.actor.system.attacks.filter((_, i) => i !== index),
    });
  }

  /**
   * 共鳴判定を要求する。暫定は、ターゲットした共鳴者に怪異の共鳴プリセットの強度を
   * 差し込んで共鳴判定を振らせる。全共鳴者への要求カード・感情マッチング自動化は #75。
   */
  static async _requestResonance(this: EmokloreKaiSheet) {
    const targets = resolveTargetActors().filter((actor) => actor.isCharacter());
    if (targets.length === 0) {
      ui.notifications?.warn("EMOKLORE.Actor.kai.NoResonanceTarget", { localize: true });
      return;
    }

    const intensity = this.actor.system.resonance.intensity;
    for (const target of targets) {
      await requestResonanceRoll(target, {}, { intensity });
    }
  }
}

/** 怪異シートの表示用コンテキスト */
type KaiSheetContext = {
  // 基底の EmokloreDocumentSheetContext と対応する分
  isPlay: boolean;
  owner: boolean;
  limited: boolean;
  gm: boolean;
  document: EmokloreActor;
  system: KaiDataModel;
  systemFields: Record<string, foundry.data.fields.DataField>;
  flags: Record<string, unknown>;
  emotionOptions: Array<{ value: string; label: string; group: string; selected: boolean }>;
  selectedEmotions: Array<{ value: string; label: string; group: string }>;
  mutationHTML: string;
  resonanceTableLink: string;
};
