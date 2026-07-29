import { isResonantEmotionKey } from "../config/resonant-emotions";
import { systemPath } from "../constants";
import type { CharacterDataModel } from "../data/character";
import type { EmokloreActor } from "../documents/actor";
import { getSetting, setSetting } from "../settings";
import { getEmbeddedDocument, resolveEmbeddedDocumentClass } from "../utils/sheet";
import { EmokloreActorSheet } from "./actor-sheet";
import { CharSheetImportDialog } from "./charsheet-import-dialog";
import {
  buildBiographyContext,
  buildEffectsContext,
  buildItemsContext,
  buildSidebarContext,
  buildSkillsContext,
} from "./context/character";
import { promptCreateSkill } from "./dialogs/create-skill-dialog";
import { EmotionPicker } from "./emotion-picker";
import {
  EMOTION_KEYS,
  getAcquiredEmotionRows,
  getEmotionRows,
  resolveSegmentValue,
} from "./helpers";
import type { CharacterContext, EmokloreRenderOptions, EmotionKey } from "./types";
/**
 * characterアクターのシート。
 *
 * 技能・プロフィール・効果の3タブを持ち、閲覧と編集をモードで出し分ける。
 * モード切替とコンテキストの基礎部分は document-sheet-mixin が持つ。
 */
export class EmokloreCharacterSheet extends EmokloreActorSheet {
  // このシートは type: "character" にしか登録しないので、actor は共鳴者に絞れる。
  // 能力値・技能・感情を種別の絞り込みなしで読めるようにする
  declare actor: EmokloreActor & { system: CharacterDataModel };

  static override DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    classes: ["standard-form", "character"],
    position: {
      // カード列は250px固定なので、広げたぶんはすべて右の技能列に回る
      width: 760,
      height: 710,
    },
    // ウィンドウ枠の操作メニュー（⋮）に足す。本体の window.controls は継承チェーンで
    // 連結されるので、ActorSheetV2 の4つ（トークン設定・立ち絵表示など）の後ろに並ぶ。
    // シート本文にツールバーを置くとヘッダのレイアウト制約になるため、こちらに寄せている
    window: {
      controls: [
        {
          action: "importCharacter",
          icon: "fa-solid fa-file-import",
          label: "EMOKLORE.Import.ImportTooltip",
          ownership: "OWNER",
        },
      ],
    },
    actions: {
      ...super.DEFAULT_OPTIONS.actions,
      toggleEffect: this._toggleEffect,
      toggleEquipped: this._toggleEquipped,
      importCharacter: this._importCharacter,
      selectSegment: this._selectSegment,
      toggleSidebar: this._toggleSidebar,
      createSkill: this._createSkill,
      pickEmotions: this._pickEmotions,
      pickAcquiredEmotions: this._pickAcquiredEmotions,
    },
  };

  static override PARTS = {
    header: {
      template: systemPath("templates/actor/header.hbs"),
      // 入れ子のpartialは再帰的に解決されないので、使うものをすべて並べる
      templates: [
        "templates/actor/partials/meter.hbs",
        "templates/actor/partials/emotion-rows.hbs",
      ].map(systemPath),
    },
    // 本体のテンプレートなので systemPath は通さない
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    // タブに属さないパート。class="tab" と data-group を持たないので changeTab が
    // 触らず、タブを切り替えてもDOMごと残る（スクロール位置も入力中の値も保たれる）
    sidebar: {
      template: systemPath("templates/actor/sidebar.hbs"),
      templates: [
        "templates/actor/partials/card.hbs",
        "templates/actor/partials/stat-row.hbs",
        "templates/actor/partials/segments.hbs",
      ].map(systemPath),
      // トグルは畳んでも見えている必要があるので、内側だけをスクロールさせる
      scrollable: [".em-sidebar__scroll"],
    },
    skills: {
      template: systemPath("templates/actor/skills-tab.hbs"),
      templates: [
        "templates/actor/skills.hbs",
        "templates/actor/base-skills.hbs",
        "templates/actor/partials/skill-row-play.hbs",
        "templates/actor/partials/skill-row-edit.hbs",
        "templates/actor/partials/custom-skill-row-play.hbs",
        "templates/actor/partials/custom-skill-row-edit.hbs",
        "templates/actor/partials/segments.hbs",
        "templates/partials/doc-controls.hbs",
      ].map(systemPath),
      scrollable: [""],
    },
    biography: {
      template: systemPath("templates/actor/biography.hbs"),
      templates: ["templates/partials/field.hbs"].map(systemPath),
      scrollable: [""],
    },
    items: {
      template: systemPath("templates/actor/items.hbs"),
      templates: ["templates/partials/doc-controls.hbs"].map(systemPath),
      scrollable: [""],
    },
    effects: {
      template: systemPath("templates/actor/effects.hbs"),
      templates: [
        "templates/actor/partials/effect-sections.hbs",
        "templates/partials/doc-controls.hbs",
      ].map(systemPath),
      scrollable: [""],
    },
  };

  static override TABS = {
    primary: {
      tabs: [{ id: "skills" }, { id: "biography" }, { id: "items" }, { id: "effects" }],
      labelPrefix: "EMOKLORE.Sheet.character.tab",
      initial: "skills",
    },
  };

  override async _prepareContext(options: EmokloreRenderOptions): Promise<CharacterContext> {
    // 基底のコンテキストはドキュメント種別を問わない形なので、
    // characterシートであることが分かっているここで1回だけ絞る
    const baseContext = await super._prepareContext(options);
    const context = baseContext as CharacterContext;
    context.config = CONFIG.EMOKLORE;
    context.emotionRows = getEmotionRows(
      context.system.emotions,
      context.config.resonantEmotions,
      context.config.emotionAttributes,
    );
    context.acquiredEmotionRows = getAcquiredEmotionRows(
      context.system.emotions.acquired,
      context.config.resonantEmotions,
      context.config.emotionAttributes,
    );

    return context;
  }

  override async _preparePartContext(
    partId: string,
    context: CharacterContext,
    options: EmokloreRenderOptions,
  ): Promise<CharacterContext> {
    await super._preparePartContext(partId, context, options);

    // 何を積むかは applications/context/character.ts が決める。戻り値は
    // Pick<CharacterContext, ...> で縛ってあるので、無いキーを積もうとすると型で止まる
    switch (partId) {
      case "sidebar":
        Object.assign(context, buildSidebarContext(this.actor));
        break;
      case "skills":
        Object.assign(context, buildSkillsContext(this.actor, { isPlay: context.isPlay }));
        break;
      case "biography":
        Object.assign(context, await buildBiographyContext(this.actor));
        break;
      case "items":
        Object.assign(context, buildItemsContext(this.actor));
        break;
      case "effects":
        Object.assign(context, buildEffectsContext(this.actor));
        break;
      default:
        // header / tabs は追加のコンテキストを必要としないので何もしない
        break;
    }

    if (partId in context.tabs) context.tab = context.tabs[partId] as unknown;
    return context;
  }

  static async _toggleEffect(this: EmokloreCharacterSheet, _event: Event, target: HTMLElement) {
    const effect = getEmbeddedDocument(target, this.actor);
    if (effect) await effect.update({ disabled: !effect.disabled });
  }

  /**
   * アイテムタブの装備チェックボックス。
   *
   * アイテムの値の編集だがシートのフォームには載せられない（同じ name の入力を
   * 2箇所に描けない）ので、name を持たないチェックボックスから直接アイテムへ書く。
   */
  static async _toggleEquipped(this: EmokloreCharacterSheet, _event: Event, target: HTMLElement) {
    const item = getEmbeddedDocument(target, this.actor);
    if (item) await item.update({ "system.equipped": (target as HTMLInputElement).checked });
  }

  static async _importCharacter(this: EmokloreCharacterSheet, event: Event, _target: HTMLElement) {
    event.preventDefault();
    await CharSheetImportDialog.show(this.actor);
  }

  /**
   * カスタム技能を作る。
   *
   * `createDoc` は dataset をそのまま作成データに載せる汎用の口だが、技能は名前と
   * 参照能力値が決まっていないと行を描けないので、先にダイアログで尋ねる。
   * 「尋ねるかどうか」はプレゼンテーションの決定なので applications 側に置く。
   */
  static async _createSkill(this: EmokloreCharacterSheet, event: Event, _target: HTMLElement) {
    event.preventDefault();

    const input = await promptCreateSkill();
    if (!input) return;

    // defaultName / create は ClientDocumentMixin 由来で本体の型に出ないため、
    // utils/sheet.ts の口を通す（createDoc と同じ経路）
    const docCls = resolveEmbeddedDocumentClass("Item");

    await docCls.create(
      {
        // 名前は空でも通す。あとから鉛筆で直せるので、入力し直しを強いるより
        // 既定の名前で作ってしまうほうが早い（本体の createDoc と同じ扱い）
        name: input.name || docCls.defaultName({ type: "skill", parent: this.actor }),
        type: "skill",
        system: {
          category: input.category,
          characteristicOptions: input.characteristicOptions,
          // 選べるものが1つでも、判定に使う能力値は明示しておく
          characteristic: input.characteristicOptions[0],
          group: input.group,
        },
      },
      { parent: this.actor },
    );
  }

  /**
   * 共鳴感情をピッカーで選び直す。
   *
   * 枠のラベルはスキーマから引く。`localizeSchema` が `lang/ja.json` の FIELDS を入れて
   * くれるので、言語キーをここで組み立てずに済む。
   */
  static async _pickEmotions(this: EmokloreCharacterSheet, event: Event) {
    event.preventDefault();

    const emotions = this.actor.system.emotions;
    // SchemaField の入れ子は本体の型に出ないので、実際に使うメンバーだけ交差型で補う。
    // キーを EmotionKey に絞ると、有限キーの Record として undefined 無しで引ける
    const field = this.actor.system.schema.fields.emotions as foundry.data.fields.DataField & {
      fields: Record<EmotionKey, { label: string }>;
    };

    const picked = await EmotionPicker.pickSlots(
      EMOTION_KEYS.map((key) => {
        const saved = emotions[key];

        return {
          key,
          label: field.fields[key].label,
          // 保存値は素の StringField で `choices` が無い。感情キーとして名乗る前に確かめる
          value: saved && isResonantEmotionKey(saved) ? saved : null,
        };
      }),
    );
    if (!picked) return;

    // 未選択は空文字で書く。null を入れると素の StringField では扱いが揺れる
    await this.actor.update(
      Object.fromEntries(EMOTION_KEYS.map((key) => [`system.emotions.${key}`, picked[key] ?? ""])),
    );
  }

  /**
   * 追加取得した共鳴感情を選び直す。
   *
   * 共振（ハウリングの「対象の《怪異》が持つ共鳴感情をひとつ追加で獲得する」）や怪異の
   * 付与で増える枠で、枚数が決まらないので複数選択モードで開く（怪異シートと同じ形）。
   * どの感情を取るかはルール上その場で決まるので、選ぶのは人の側になる。
   */
  static async _pickAcquiredEmotions(this: EmokloreCharacterSheet, event: Event) {
    event.preventDefault();

    const picked = await EmotionPicker.pickMany(this.actor.system.emotions.acquired);
    if (!picked) return;

    await this.actor.update({ "system.emotions.acquired": picked });
  }

  /**
   * 段入力で、いま選ばれている段をもう一度押したときに値を戻す。
   *
   * ラジオは押しても外れないので、0（未修得）に戻す手段がこれしかない。
   * 段を1つ増やして0を置く手もあるが、バーの左端が常に空いて見えるのでやめた。
   *
   * 選択中でない段を押したときは何もしない。ラジオの既定の動作と
   * submitOnChange に任せる。
   */
  static async _selectSegment(this: EmokloreCharacterSheet, event: Event, target: HTMLElement) {
    const input = target as HTMLInputElement;
    const value = Number(input.value);
    if (!Number.isFinite(value)) return;

    // Number("") は NaN ではなく 0 なので、空文字は「属性が無い」と同じに倒す
    const raw = input.dataset.clearTo;
    const clearTo = raw ? Number(raw) : undefined;

    // カスタム技能のレベルはアイテム側が正。段の name はアクター側のミラー
    // （保存しない枠）を指しているので、フォームの送信に任せると値がどこにも残らない。
    // 組込技能・能力値は name がそのまま保存先なので、書き込みはフォームに任せる
    const itemId = input.closest<HTMLElement>("[data-item-id]")?.dataset.itemId;
    const item = itemId ? this.actor.items.get(itemId) : undefined;

    if (item?.isSkill()) {
      const next = resolveSegmentValue(value, item.system.level, clearTo);
      if (next === null || next === item.system.level) return;

      // ラジオの既定動作を止めないと、checked が立ったままアクターのフォームが送られる
      event.preventDefault();
      await item.update({ "system.level": next });
      return;
    }

    const current = Number(foundry.utils.getProperty(this.actor, input.name));
    const next = resolveSegmentValue(value, current, clearTo);
    // 選択中でない段（next === value）はラジオの既定動作と submitOnChange に任せる。
    // 戻せない入力（能力値は1未満にならない）で押し直したときは null が返る
    if (next === null || next === value) return;

    // ラジオの既定動作を止めないと、checked が立って submitOnChange が
    // 元の値で送られ、こちらの更新を打ち消してしまう
    event.preventDefault();
    await this.actor.update({ [input.name]: next });
  }

  /**
   * カスタム技能の参照能力値を書く。
   *
   * 本体の actions はクリックしか見ないので、select の change はフォームの change を
   * 拾う本体の口（`_onChangeForm`）で受ける。リスナは初回描画で1本張られたきり
   * 差し替わらないので、描画のたびに繋ぎ直す必要がない。
   *
   * 拾ったぶんは super に渡さない。この select は name を持たずアイテム側が保存先なので、
   * アクターのフォームを送っても何も起きない。
   */
  override _onChangeForm(formConfig: unknown, event: Event): void {
    const select = (event.target as HTMLElement | null)?.closest?.<HTMLSelectElement>(
      "select[data-skill-characteristic]",
    );

    if (select) {
      const itemId = select.closest<HTMLElement>("[data-item-id]")?.dataset.itemId;
      const item = itemId ? this.actor.items.get(itemId) : undefined;
      if (item?.isSkill()) void item.update({ "system.characteristic": select.value });
      return;
    }

    super._onChangeForm(formConfig, event);
  }

  /**
   * サイドバーの開閉。
   *
   * 再描画はしない。表示状態を切り替えるだけでドキュメントに触る理由がないうえ、
   * submitOnChange の下でシート全体を描き直すとスクロール位置やフォーカスが動く。
   * ルート要素のクラスだけを付け替える。
   */
  static async _toggleSidebar(this: EmokloreCharacterSheet): Promise<void> {
    const collapsed = !getSetting("sidebarCollapsed");
    await setSetting("sidebarCollapsed", collapsed);
    this._applySidebarState(collapsed);
  }

  override async _onRender(
    context: CharacterContext,
    options: EmokloreRenderOptions,
  ): Promise<void> {
    await super._onRender(context, options);
    this._applySidebarState(getSetting("sidebarCollapsed"));
  }

  private _applySidebarState(collapsed: boolean): void {
    this.element.classList.toggle("em-sidebar-collapsed", collapsed);

    // 畳んだ中身は枠の外へ送り出されて見えないだけなので、
    // フォーカスと読み上げの対象からも外す
    this.element.querySelector(".em-sidebar__scroll")?.toggleAttribute("inert", collapsed);

    const toggle = this.element.querySelector(".em-sidebar__toggle");
    if (!toggle) return;
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.setAttribute(
      "data-tooltip",
      collapsed ? "APPLICATION.ACTIONS.Expand" : "APPLICATION.ACTIONS.Collapse",
    );

    // 三角の向きはクラスを差し替えて変える。rotate だと、本体が button に
    // 当てている transition: 0.5s（プロパティ無指定）に巻き込まれて
    // 途中で三角が上を向く
    toggle.classList.toggle("fa-caret-left", !collapsed);
    toggle.classList.toggle("fa-caret-right", collapsed);

    // 閲覧専用のシートでは本体の _toggleDisabled が .window-content 内の
    // フォーム要素をまとめて無効化する（document-sheet.mjs の _onRender）。
    // 開閉は編集ではないので、このボタンだけは押せる状態に戻す
    if (toggle instanceof HTMLButtonElement) toggle.disabled = false;
  }
}
