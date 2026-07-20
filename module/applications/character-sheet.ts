import type { CharacteristicKey } from "../config/characteristics";
import type { SkillKey } from "../config/skills";
import { systemPath } from "../constants";
import {
  CHARACTERISTIC_MAX,
  CHARACTERISTIC_MIN,
  SKILL_LEVEL_MAX,
  SKILL_LEVEL_MIN,
} from "../data/character";
import type { EmokloreActor } from "../documents/actor";
import {
  CHARACTERISTIC_POINT_MAX,
  calculateCharPointSum,
  calculateTotalSkillPoints,
  SKILL_POINT_MAX,
} from "../rules/character-points";
import { getSetting, setSetting } from "../settings";
import { prepareActiveEffectCategories } from "../utils/effects";
import {
  createDocumentData,
  getEmbeddedDocument,
  resolveEmbeddedDocumentClass,
} from "../utils/sheet";
import { EmokloreActorSheet } from "./actor-sheet";
import { CharSheetImportDialog } from "./charsheet-import-dialog";
import {
  BIOGRAPHY_PAIRED_COUNT,
  buildBiographyRows,
  buildValueSegments,
  createEmotionOptions,
  getEmotionRows,
} from "./helpers";
import type {
  BaseSkillRow,
  CharacterContext,
  CharacteristicsMap,
  EmokloreRenderOptions,
  LabeledField,
  SkillRow,
} from "./types";

/**
 * characterアクターのシート。
 *
 * 技能・プロフィール・効果の3タブを持ち、閲覧と編集をモードで出し分ける。
 * モード切替とコンテキストの基礎部分は document-sheet-mixin が持つ。
 */
export class EmokloreCharacterSheet extends EmokloreActorSheet {
  declare actor: EmokloreActor;

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
      viewDoc: this._viewDoc,
      createDoc: this._createDoc,
      deleteDoc: this._deleteDoc,
      toggleEffect: this._toggleEffect,
      importCharacter: this._importCharacter,
      selectSegment: this._selectSegment,
      toggleSidebar: this._toggleSidebar,
    },
  };

  static override PARTS = {
    header: {
      template: systemPath("templates/actor/header.hbs"),
      // 入れ子のpartialは再帰的に解決されないので、使うものをすべて並べる
      templates: [systemPath("templates/actor/partials/meter.hbs")],
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
        "templates/actor/partials/segments.hbs",
      ].map(systemPath),
      scrollable: [""],
    },
    biography: {
      template: systemPath("templates/actor/biography.hbs"),
      templates: ["templates/actor/partials/field.hbs"].map(systemPath),
      scrollable: [""],
    },
    effects: {
      template: systemPath("templates/actor/effects.hbs"),
      scrollable: [""],
    },
  };

  static override TABS = {
    primary: {
      tabs: [{ id: "skills" }, { id: "biography" }, { id: "effects" }],
      labelPrefix: "EMOKLORE.CharacterSheet.tab",
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

    context.emotionOptions = createEmotionOptions();
    return context;
  }

  override async _preparePartContext(
    partId: string,
    context: CharacterContext,
    options: EmokloreRenderOptions,
  ): Promise<CharacterContext> {
    await super._preparePartContext(partId, context, options);

    switch (partId) {
      case "sidebar":
        this._prepareSidebarContext(context);
        break;
      case "skills":
        this._prepareSkillsContext(context);
        break;
      case "biography":
        await this._prepareBiographyContext(context);
        break;
      case "effects":
        this._prepareEffectsContext(context);
        break;
      default:
        // header / tabs は追加のコンテキストを必要としないので何もしない
        break;
    }

    if (partId in context.tabs) context.tab = context.tabs[partId] as unknown;
    return context;
  }

  static async _viewDoc(this: EmokloreCharacterSheet, _event: Event, target: HTMLElement) {
    getEmbeddedDocument(target, this.actor)?.sheet?.render(true);
  }

  static async _deleteDoc(this: EmokloreCharacterSheet, _event: Event, target: HTMLElement) {
    await getEmbeddedDocument(target, this.actor)?.delete();
  }

  static async _createDoc(
    this: EmokloreCharacterSheet,
    _event: Event,
    target: HTMLElement & { dataset: DOMStringMap },
  ) {
    const docData = createDocumentData(target, this.actor);
    const docCls = resolveEmbeddedDocumentClass(target.dataset.documentClass);
    await docCls.create(docData, { parent: this.actor });
  }

  static async _toggleEffect(this: EmokloreCharacterSheet, _event: Event, target: HTMLElement) {
    const effect = getEmbeddedDocument(target, this.actor);
    if (effect) await effect.update({ disabled: !effect.disabled });
  }

  static async _importCharacter(this: EmokloreCharacterSheet, event: Event, _target: HTMLElement) {
    event.preventDefault();
    await CharSheetImportDialog.show(this.actor);
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
    // 属性が無い・空なら解除できない入力（能力値は1未満にならない）。
    // Number("") は NaN ではなく 0 なので、空文字は先に弾く
    const raw = input.dataset.clearTo;
    if (!raw) return;
    const clearTo = Number(raw);
    if (!Number.isFinite(clearTo)) return;

    const current = foundry.utils.getProperty(this.actor, input.name);
    if (Number(input.value) !== current) return;

    // ラジオの既定動作を止めないと、checked が立って submitOnChange が
    // 元の値で送られ、こちらの更新を打ち消してしまう
    event.preventDefault();
    await this.actor.update({ [input.name]: clearTo });
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

  /**
   * 能力値の表示用データ。
   *
   * アイコンは CONFIG.EMOKLORE 側の定義なので、テンプレートで二重の lookup を
   * 組まずに済むようここで引いておく。
   */
  _getCharacteristics(): CharacteristicsMap {
    return Object.fromEntries(
      Object.entries(CONFIG.EMOKLORE.characteristics).map(([chc, { fa }]) => {
        const value = this.actor.system.characteristics[chc as CharacteristicKey]?.value ?? 0;
        return [
          chc,
          {
            field: this.actor.system.schema.getField(["characteristics", chc]),
            value,
            icon: fa,
            name: `system.characteristics.${chc}.value`,
            segments: buildValueSegments(CHARACTERISTIC_MIN, CHARACTERISTIC_MAX, value),
          },
        ];
      }),
    );
  }

  /**
   * 技能の表示用データ。
   *
   * label / isExtra はアクターに保存せず CONFIG.EMOKLORE 側の定義なので、ここで合流させる。
   * 能力値ラベルも同様に引いておく。CONFIG の label は i18nInit の performPreLocalization で
   * 翻訳済みなので、テンプレート側で言語キーを組み立てる必要はない。
   */
  _getSkills(): Record<string, SkillRow> {
    return Object.fromEntries(
      Object.entries(CONFIG.EMOKLORE.skills).map(([key, { label, isExtra }]) => {
        const entry = this.actor.system.skills[key as SkillKey];
        const characteristic = CONFIG.EMOKLORE.characteristics[entry.characteristic];
        return [
          key,
          {
            field: this.actor.system.schema.getField(["skills", key]),
            label,
            isExtra: isExtra ?? false,
            level: entry.level,
            target: entry.target,
            characteristic: entry.characteristic,
            specialization: entry.specialization,
            mod: entry.mod,
            characteristicLabel: characteristic?.label ?? "",
            characteristicIcon: characteristic?.fa ?? "",
            name: `system.skills.${key}.level`,
            // 段は1から。0（未修得）は段を置かず、選択中の段を押し直して戻す
            levelSegments: buildValueSegments(SKILL_LEVEL_MIN + 1, SKILL_LEVEL_MAX, entry.level),
          },
        ];
      }),
    );
  }

  /**
   * 基本技能の表示用データ。
   *
   * 目標値と能力値はアクターに、表示名は CONFIG.EMOKLORE にあるので、ここで合流させる。
   */
  _getBaseSkills(): BaseSkillRow[] {
    return Object.entries(this.actor.system.baseSkills).map(
      ([key, { characteristic, target }]) => ({
        key,
        label:
          CONFIG.EMOKLORE.baseSkills[key as keyof typeof CONFIG.EMOKLORE.baseSkills]?.label ?? "",
        target,
        characteristicIcon: CONFIG.EMOKLORE.characteristics[characteristic]?.fa ?? "",
      }),
    );
  }

  /**
   * サイドバーの表示用データ。
   *
   * 能力値はカードにしか出ないので、ここでだけ用意する。以前は技能パートが
   * 積んだものを経歴パートが拾っており（_preparePartContext は同じ context を
   * 共有する）、パートの順序に暗黙に依存していた。
   */
  private _prepareSidebarContext(context: CharacterContext): void {
    context.characteristics = this._getCharacteristics();
    context.charPointSum = calculateCharPointSum(context.characteristics);
    context.charPointMax = CHARACTERISTIC_POINT_MAX;
    context.sidebarCollapsed = getSetting("sidebarCollapsed");
  }

  private _prepareSkillsContext(context: CharacterContext): void {
    context.skills = this._getSkills();
    context.skillPointSum = this._calculateSkillPointSumFromContext(context.skills);
    context.skillPointMax = SKILL_POINT_MAX;
    context.baseSkills = this._getBaseSkills();
  }

  /**
   * 経歴の表示用データ。
   *
   * 備考は system.json で htmlFields に指定しているリッチテキストなので、
   * @UUID リンクやインラインロールを解決するため描画前に enrichHTML を通す。
   */
  private async _prepareBiographyContext(context: CharacterContext): Promise<void> {
    const noteHTML = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      this.actor.system.biography.note,
      {
        secrets: this.actor.isOwner,
        relativeTo: this.actor,
        rollData: this.actor.getRollData(),
      },
    );

    // systemFields の型は DataField 止まりで fields に降りられないため、スキーマから引く。
    // fields の値も label を持つ形に補っておき、キャストを1回で済ませる
    const biography = this.actor.system.schema.getField([
      "biography",
    ]) as foundry.data.fields.SchemaField & { fields: Record<string, LabeledField> };

    const rows = buildBiographyRows(biography.fields, this.actor.system.biography, {
      note: noteHTML,
    });

    // 先頭の数件は横並びの組にするので、テンプレート側で分けて回せるよう2つに割る
    context.biographyPairedRows = rows.slice(0, BIOGRAPHY_PAIRED_COUNT);
    context.biographyRows = rows.slice(BIOGRAPHY_PAIRED_COUNT);
  }

  private _prepareEffectsContext(context: CharacterContext): void {
    context.tab = context.tabs.effects;
    context.effects = prepareActiveEffectCategories(this.actor.allApplicableEffects());
  }

  private _calculateSkillPointSumFromContext(skills: Record<string, SkillRow>): number {
    const skillsObject = Object.values(skills);
    const exSkillsObject = skillsObject.filter((skill) => skill.isExtra);
    return calculateTotalSkillPoints(skillsObject, exSkillsObject);
  }
}
