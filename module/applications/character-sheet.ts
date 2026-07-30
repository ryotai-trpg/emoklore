import { isResonantEmotionKey } from "../config/resonant-emotions";
import { systemPath } from "../constants";
import type { CharacterDataModel } from "../data/character";
import type { EmokloreActor } from "../documents/actor";
import { getSetting, setSetting } from "../settings";
import { EmokloreActorSheet } from "./actor-sheet";
import { CharSheetImportDialog } from "./charsheet-import-dialog";
import { buildItemsContext } from "./context/actor";
import {
  buildBiographyContext,
  buildEffectsContext,
  buildSidebarContext,
} from "./context/character";
import { buildSkillsContext } from "./context/skills";
import { EmotionPicker } from "./emotion-picker";
import { EMOTION_KEYS, getAcquiredEmotionRows, getEmotionRows } from "./helpers";
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
      importCharacter: this._importCharacter,
      toggleSidebar: this._toggleSidebar,
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
    tabs: EmokloreActorSheet.TAB_NAV_PART,
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

    return context;
  }

  static async _importCharacter(this: EmokloreCharacterSheet, event: Event, _target: HTMLElement) {
    event.preventDefault();
    await CharSheetImportDialog.show(this.actor);
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
