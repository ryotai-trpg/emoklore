import { systemPath } from "../constants";
import type { KaiAttack, KaiDataModel } from "../data/kai";
import type { EmokloreActor } from "../documents/actor";
import { formatEmotion } from "../utils/emotion";
import { enrichDocumentHTML } from "../utils/sheet";
import { EmokloreActorSheet } from "./actor-sheet";
import { EmotionPicker } from "./emotion-picker";
import { buildEmotionColumns } from "./helpers";
import { requestResonanceCheck } from "./requests";
import type { EmokloreRenderOptions, KaiSheetContext } from "./types";

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
 * 攻撃リストを持つ。攻撃はカードに出して振り、共鳴プリセットからは共鳴判定の要求カードを
 * チャットに出す。
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
      pickEmotions: this._pickEmotions,
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

    // 表示は「感情（属性）」。並びはピッカーの列と同じ属性順にする
    const selected = new Set<string>(system.emotions);
    context.selectedEmotions = buildEmotionColumns(
      CONFIG.EMOKLORE.resonantEmotions,
      CONFIG.EMOKLORE.emotionAttributes,
    ).flatMap((column) =>
      column.emotions
        .filter((emotion) => selected.has(emotion.key))
        .map((emotion) => ({ key: emotion.key, label: formatEmotion(emotion.key) })),
    );

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

  /** 怪異の共鳴感情をピッカーで選び直す。枚数が決まらないので複数選択モードで開く */
  static async _pickEmotions(this: EmokloreKaiSheet, event: Event) {
    event.preventDefault();

    const picked = await EmotionPicker.pickMany(this.actor.system.emotions);
    if (!picked) return;

    await this.actor.update({ "system.emotions": picked });
  }

  /**
   * 共鳴判定を要求する。怪異の共鳴プリセットを初期値にして要求カードを出す。
   *
   * 共鳴感情は持っているものを全部渡す。共鳴者はそのどれかに一致すればよいので、
   * 感情を多く持つ怪異ほど多くの共鳴者を鳴らせる。絞りたいDLはダイアログで外す。
   */
  static async _requestResonance(this: EmokloreKaiSheet) {
    const { resonance, emotions } = this.actor.system;

    await requestResonanceCheck({
      intensity: resonance.intensity,
      rise: resonance.rise,
      emotions: [...emotions],
      kaiUuid: this.actor.uuid ?? null,
    });
  }
}
