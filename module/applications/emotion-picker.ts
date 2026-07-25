import type {
  ApplicationRenderContext,
  ApplicationRenderOptions,
} from "@client/applications/_types.mjs";
import type { HandlebarsRenderOptions } from "@client/applications/api/handlebars-application.mjs";
import { isResonantEmotionKey, type ResonantEmotionKey } from "../config/resonant-emotions";
import { systemPath } from "../constants";
import { formatEmotion } from "../utils/emotion";
import { buildEmotionColumns } from "./helpers";
import type { ApplicationV2Statics } from "./types";

const { HandlebarsApplicationMixin } = foundry.applications.api;

/** 埋める枠1つぶん。`value` はいま入っている感情キーで、未選択は null */
export type EmotionSlot = {
  key: string;
  label: string;
  value: ResonantEmotionKey | null;
};

/** 枠モードの結果。枠のキーごとに感情キーか null を返す */
export type EmotionSlotResult = Record<string, ResonantEmotionKey | null>;

/**
 * 決定したときの中身。モードで形が違うので判別可能unionにする。
 *
 * 呼び出し口（`pickSlots` / `pickMany`）が自分のモードだけを取り出すので、
 * 戻り値をキャストで名乗り直す必要がない。
 */
type PickerResult =
  | { mode: "slots"; slots: EmotionSlotResult }
  | { mode: "multiple"; emotions: ResonantEmotionKey[] };

type PickerCell = { key: string; label: string; selected: boolean };
type PickerColumn = { attribute: string; label: string; emotions: PickerCell[] };
type PickerSlot = { key: string; label: string; value: string; active: boolean; filled: boolean };

type EmotionPickerContext = ApplicationRenderContext & {
  columns: PickerColumn[];
  slots: PickerSlot[];
  /** 複数選択モードで選ばれている感情。枠モードでは枠チップが同じ役目を持つ */
  tags: Array<{ key: string; label: string }>;
  multiple: boolean;
  hint: string;
};

/**
 * 5属性×47感情を一望して選ぶピッカー。
 *
 * **呼び出し元に依存しない。** 枠の定義か選択済みの集合を受け取り、選んだ結果を返すだけで、
 * ドキュメントの書き換えはしない。書き戻すのは呼んだ側（シート）の仕事。おかげで共鳴者の
 * 表/裏/ルーツ・怪異の共鳴感情・共鳴判定要求のGM側と、同じ部品を使い回せる。
 *
 * モードは2つ。枠モードは枠を選んでから感情を押して埋める（表/裏/ルーツ）。複数選択モードは
 * 感情を押すたびにトグルする（怪異・追加取得）。同じ感情を複数の枠に入れることは妨げない
 * （表とルーツが同じ感情のキャラクターは作れる）。
 *
 * 状態（どの枠を埋めているか・いま何が選ばれているか）と複数のアクションを持つので、
 * `DialogV2.prompt` ではなく ApplicationV2 のサブクラスにしてある（docs/ui-design.md）。
 */
export class EmotionPicker extends (HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
) as ReturnType<typeof HandlebarsApplicationMixin> & ApplicationV2Statics) {
  static override DEFAULT_OPTIONS = {
    id: "emotion-picker-{id}",
    // emoklore は変数の定義スコープ、emotion-picker はこのピッカーのスタイルのスコープ。
    // standard-form は必須（本体の .form-footer などはすべてその子孫にスコープされている）
    classes: ["emoklore", "standard-form", "emotion-picker"],
    tag: "form",
    form: {
      handler: EmotionPicker.onSubmit,
      closeOnSubmit: true,
    },
    window: {
      title: "EMOKLORE.EmotionPicker.Title",
      icon: "fa-solid fa-heart",
      resizable: true,
    },
    position: {
      width: 680,
      height: "auto",
    },
    actions: {
      selectSlot: EmotionPicker.onSelectSlot,
      clearSlot: EmotionPicker.onClearSlot,
      pickEmotion: EmotionPicker.onPickEmotion,
      removeEmotion: EmotionPicker.onRemoveEmotion,
      cancel: EmotionPicker.onCancel,
    },
  };

  static override PARTS = {
    form: {
      template: systemPath("templates/apps/emotion-picker.hbs"),
      // 入れ子のpartialは再帰的に解決されないので、使うものを並べる
      templates: [systemPath("templates/apps/partials/emotion-tags.hbs")],
    },
  };

  /** 枠モードの枠。複数選択モードでは空 */
  #slots: EmotionSlot[];

  /**
   * 複数選択モードの選択。枠モードでは使わない。
   *
   * 中身は感情キーだが `Set<string>` で持つ。列のマス（`key: string`）と突き合わせるのに
   * 型を狭めておくと `has` が呼べず、結局キャストが要るため。名乗り直しは取り出すときに
   * 型述語で行う
   */
  #selected: Set<string>;

  #multiple: boolean;

  /** いま埋めている枠のキー。枠モードでのみ意味を持つ */
  #activeSlot: string | null;

  /** 結果を呼び出し元へ渡す口。`#wait` が入れて、決定か閉じるかで1回だけ呼ばれる */
  #resolve: ((result: PickerResult | null) => void) | null = null;

  /** 決定を通ったか。閉じたときに結果を null で上書きしないための番人 */
  #decided = false;

  constructor(config: { slots?: EmotionSlot[]; selected?: Iterable<string> }, options = {}) {
    super(options);

    this.#multiple = config.slots === undefined;
    this.#slots = (config.slots ?? []).map((slot) => ({ ...slot }));
    // 保存データ由来の文字列なので、知らないキーはここで落とす
    this.#selected = new Set<string>(
      Array.from(config.selected ?? []).filter(isResonantEmotionKey),
    );
    // 最初は未選択の枠から埋めさせる。全部埋まっていれば先頭を差し替える構え
    this.#activeSlot = (this.#slots.find((slot) => !slot.value) ?? this.#slots[0])?.key ?? null;
  }

  /**
   * 枠を埋めるモードで開く。表/裏/ルーツのように行き先が決まっている選択に使う。
   *
   * @returns 枠のキーごとの感情キー。キャンセルされたら null
   */
  static async pickSlots(
    slots: EmotionSlot[],
    { title }: { title?: string } = {},
  ): Promise<EmotionSlotResult | null> {
    const result = await new EmotionPicker({ slots }, windowOptions(title)).wait();

    return result?.mode === "slots" ? result.slots : null;
  }

  /**
   * 複数選択モードで開く。怪異の共鳴感情や追加取得のように枚数が決まらない選択に使う。
   *
   * @returns 選ばれた感情キー。キャンセルされたら null
   */
  static async pickMany(
    selected: Iterable<string>,
    { title }: { title?: string } = {},
  ): Promise<ResonantEmotionKey[] | null> {
    const result = await new EmotionPicker({ selected }, windowOptions(title)).wait();

    return result?.mode === "multiple" ? result.emotions : null;
  }

  /** 開いて、決定か中断まで待つ */
  async wait(): Promise<PickerResult | null> {
    return new Promise((resolve) => {
      this.#resolve = resolve;
      this.render(true);
    });
  }

  override async _prepareContext(_options: HandlebarsRenderOptions): Promise<EmotionPickerContext> {
    const { resonantEmotions, emotionAttributes } = CONFIG.EMOKLORE;
    const columns = buildEmotionColumns(resonantEmotions, emotionAttributes);
    const taken = new Set<string>(
      this.#slots.map((slot) => slot.value).filter((value) => value !== null),
    );

    return {
      multiple: this.#multiple,
      // 枠モードは枠チップが選択中を見せるので、タグは複数選択モードだけ
      tags: this.#multiple
        ? Array.from(this.#selected).map((key) => ({ key, label: formatEmotion(key) }))
        : [],
      hint: game.i18n.localize(
        this.#multiple ? "EMOKLORE.EmotionPicker.HintMany" : "EMOKLORE.EmotionPicker.HintSlots",
      ),
      columns: columns.map((column) => ({
        ...column,
        emotions: column.emotions.map((emotion) => ({
          ...emotion,
          selected: this.#multiple ? this.#selected.has(emotion.key) : taken.has(emotion.key),
        })),
      })),
      slots: this.#slots.map((slot) => ({
        key: slot.key,
        label: slot.label,
        value: slot.value
          ? resonantEmotions[slot.value].label
          : game.i18n.localize("EMOKLORE.EmotionPicker.Unselected"),
        active: slot.key === this.#activeSlot,
        filled: slot.value !== null,
      })),
    };
  }

  /** 埋める枠を切り替える */
  static async onSelectSlot(this: EmotionPicker, _event: Event, target: HTMLElement) {
    const key = target.dataset.slot;
    if (!key) return;

    this.#activeSlot = key;
    await this.render();
  }

  /** 枠から感情を外す */
  static async onClearSlot(this: EmotionPicker, _event: Event, target: HTMLElement) {
    const key = target.dataset.slot;
    const slot = this.#slots.find((candidate) => candidate.key === key);
    if (!slot) return;

    slot.value = null;
    this.#activeSlot = slot.key;
    await this.render();
  }

  /**
   * 感情を選ぶ。枠モードはいまの枠に入れて次の空き枠へ進み、複数選択モードはトグルする。
   *
   * `data-emotion` はDOM由来の文字列なので、感情キーとして名乗る前に確かめる。
   */
  static async onPickEmotion(this: EmotionPicker, _event: Event, target: HTMLElement) {
    const key = target.dataset.emotion;
    if (!key || !isResonantEmotionKey(key)) return;

    if (this.#multiple) {
      if (this.#selected.has(key)) this.#selected.delete(key);
      else this.#selected.add(key);
    } else {
      const slot = this.#slots.find((candidate) => candidate.key === this.#activeSlot);
      if (!slot) return;

      slot.value = key;
      // 3枠を続けて埋められるよう、次の空き枠へ移る。空きが無ければその枠に留まり、
      // もう一度押せば入れ替えになる
      this.#activeSlot = this.#slots.find((candidate) => !candidate.value)?.key ?? slot.key;
    }

    await this.render();
  }

  /** タグの×で外す。複数選択モードだけに出る */
  static async onRemoveEmotion(this: EmotionPicker, _event: Event, target: HTMLElement) {
    const key = target.closest<HTMLElement>(".tag")?.dataset.key;
    if (!key) return;

    this.#selected.delete(key);
    await this.render();
  }

  static async onCancel(this: EmotionPicker) {
    await this.close();
  }

  /** 決定。`closeOnSubmit` で続けて閉じるので、結果はここで確定させる */
  static async onSubmit(this: EmotionPicker): Promise<void> {
    this.#decided = true;
    this.#resolve?.(
      this.#multiple
        ? { mode: "multiple", emotions: Array.from(this.#selected).filter(isResonantEmotionKey) }
        : {
            mode: "slots",
            slots: Object.fromEntries(this.#slots.map((slot) => [slot.key, slot.value])),
          },
    );
    this.#resolve = null;
  }

  /**
   * 決定を通らずに閉じたらキャンセル扱いにする。×ボタンもEscも取り消しも同じ扱い。
   *
   * 引数の型は本体の宣言（`ApplicationRenderOptions`）に合わせる。実際に渡るのは
   * `ApplicationClosingOptions` だが、ここでは読まないので食い違いは表に出ない
   */
  override _onClose(options: ApplicationRenderOptions): void {
    super._onClose(options);

    if (this.#decided) return;

    this.#resolve?.(null);
    this.#resolve = null;
  }
}

/** 呼び出し元がタイトルを差し替えるための options。渡されなければ既定のまま */
const windowOptions = (title: string | undefined) => (title ? { window: { title } } : {});
