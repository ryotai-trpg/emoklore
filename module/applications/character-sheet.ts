import { systemPath } from "../constants";
import type { EmokloreActor } from "../documents/actor";
import type { EmokloreItem } from "../documents/item";
import {
  CHARACTERISTIC_POINT_MAX,
  calculateCharPointSum,
  calculateTotalSkillPoints,
  SKILL_POINT_MAX,
} from "../rules/character-points";
import { CHARACTERISTIC_MAX, CHARACTERISTIC_MIN } from "../rules/limits";
import { getSetting, setSetting } from "../settings";
import { prepareActiveEffectCategories } from "../utils/effects";
import { typedEntries } from "../utils/object";
import {
  createDocumentData,
  enrichDocumentHTML,
  getEmbeddedDocument,
  resolveEmbeddedDocumentClass,
} from "../utils/sheet";
import { skillMarker } from "../utils/skill";
import { formatDamagePreview, formatRangeLabel } from "../utils/weapon";
import { EmokloreActorSheet } from "./actor-sheet";
import { CharSheetImportDialog } from "./charsheet-import-dialog";
import { promptCreateSkill } from "./dialogs/create-skill-dialog";
import {
  BIOGRAPHY_PAIRED_COUNT,
  buildBiographyRows,
  buildSkillLevelSegments,
  buildValueSegments,
  createEmotionOptions,
  getEmotionRows,
  resolveSegmentValue,
} from "./helpers";
import type {
  BaseSkillRow,
  CharacterContext,
  CharacteristicsMap,
  CustomSkillRow,
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
      toggleEquipped: this._toggleEquipped,
      importCharacter: this._importCharacter,
      selectSegment: this._selectSegment,
      toggleSidebar: this._toggleSidebar,
      createSkill: this._createSkill,
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
        "templates/actor/partials/custom-skill-row-play.hbs",
        "templates/actor/partials/custom-skill-row-edit.hbs",
        "templates/actor/partials/segments.hbs",
      ].map(systemPath),
      scrollable: [""],
    },
    biography: {
      template: systemPath("templates/actor/biography.hbs"),
      templates: ["templates/actor/partials/field.hbs"].map(systemPath),
      scrollable: [""],
    },
    items: {
      template: systemPath("templates/actor/items.hbs"),
      scrollable: [""],
    },
    effects: {
      template: systemPath("templates/actor/effects.hbs"),
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
      case "items":
        this._prepareItemsContext(context);
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

  /**
   * 能力値の表示用データ。
   *
   * アイコンは CONFIG.EMOKLORE 側の定義なので、テンプレートで二重の lookup を
   * 組まずに済むようここで引いておく。
   */
  _getCharacteristics(): CharacteristicsMap {
    return Object.fromEntries(
      typedEntries(CONFIG.EMOKLORE.characteristics).map(([chc, { fa }]) => {
        const value = this.actor.system.characteristics[chc].value;
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
      typedEntries(CONFIG.EMOKLORE.skills).map(([key, { label, isExtra }]) => {
        const entry = this.actor.system.skills[key];
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
            characteristicLabel: characteristic.label,
            characteristicIcon: characteristic.fa,
            name: `system.skills.${key}.level`,
            levelSegments: buildSkillLevelSegments(entry.level),
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
    return typedEntries(this.actor.system.baseSkills).map(([key, { characteristic, target }]) => ({
      key,
      label: CONFIG.EMOKLORE.baseSkills[key].label,
      target,
      characteristicIcon: CONFIG.EMOKLORE.characteristics[characteristic].fa,
    }));
  }

  /**
   * サイドバーの表示用データ。
   *
   * 能力値はカードにしか出ないので、ここでだけ用意する。_preparePartContext は
   * 同じ context を共有するため、別のパートが積んだものを拾うとパートの順序への
   * 暗黙の依存になる。
   */
  private _prepareSidebarContext(context: CharacterContext): void {
    context.characteristics = this._getCharacteristics();
    context.charPointSum = calculateCharPointSum(context.characteristics);
    context.charPointMax = CHARACTERISTIC_POINT_MAX;
    context.sidebarCollapsed = getSetting("sidebarCollapsed");
  }

  /**
   * カスタム技能の表示用データ。
   *
   * 判定に効く値はアクター側のミラー（system.customSkills）から、名前と区分は
   * アイテムから引く。ミラーは prepareBaseData が作るので、効果を適用したあとの
   * レベルと目標値がそのまま入っている。
   */
  _getCustomSkills(): CustomSkillRow[] {
    // 行に要る値はすべてミラーに揃っているので、アイテムは引き直さない。
    // 並び順は prepareBaseData が actor.items の順に詰めたまま
    return Object.entries(this.actor.system.customSkills).map(([id, entry]) => {
      const characteristic = CONFIG.EMOKLORE.characteristics[entry.characteristic];
      const options = entry.characteristicOptions.map((key) => ({
        value: key,
        label: CONFIG.EMOKLORE.characteristics[key].label,
        selected: key === entry.characteristic,
      }));

      return {
        id,
        label: entry.label,
        marker: skillMarker(entry.isBase, entry.isExtra),
        level: entry.level,
        target: entry.target,
        isBase: entry.isBase,
        isExtra: entry.isExtra,
        characteristicLabel: characteristic.label,
        characteristicIcon: characteristic.fa,
        characteristicOptions: options,
        hasCharacteristicChoice: options.length > 1,
        name: `system.customSkills.${id}.level`,
        levelSegments: buildSkillLevelSegments(entry.level),
      };
    });
  }

  private _prepareSkillsContext(context: CharacterContext): void {
    context.skills = this._getSkills();
    context.baseSkills = this._getBaseSkills();

    const customSkills = this._getCustomSkills();
    const base = customSkills.filter((skill) => skill.isBase);
    const leveled = customSkills.filter((skill) => !skill.isBase);

    // 閲覧モードのベース技能はチップ列に並ぶ。編集モードは編集・削除の口が要るので
    // 区分に関わらず技能リストへ出す（組込の基本技能は編集する項目が無いので出ない）
    context.customSkills = context.isPlay ? leveled : customSkills;
    context.customBaseSkills = context.isPlay ? base : [];

    // ベース技能はレベルを持たないので技能ポイントを消費しない
    context.skillPointSum = this._calculateSkillPointSumFromContext(context.skills, leveled);
    context.skillPointMax = SKILL_POINT_MAX;
  }

  /** 経歴の表示用データ */
  private async _prepareBiographyContext(context: CharacterContext): Promise<void> {
    const noteHTML = await enrichDocumentHTML(this.actor, this.actor.system.biography.note);

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

  /**
   * アイテムの表示用データ。
   *
   * 間合いとダメージ式は武器の派生値（参照技能から引いたもの）なので、ここでは
   * 表示用に整えるだけ。アイテムタブは読むだけの一覧で、値の編集は武器シートが持つ。
   * 同じ `name` の入力を2箇所に描くとフォームの送信が壊れるため、ここに入力は置かない。
   */
  private _prepareItemsContext(context: CharacterContext): void {
    // itemTypes は本体が Record<string, Item[]> で型付けており、実装クラスまでは絞られない
    const weapons = (this.actor.itemTypes.weapon ?? []) as EmokloreItem[];

    // isWeapon は型述語なので、filter を通すと system が WeaponDataModel に絞られる。
    // itemTypes.weapon の中身は元から武器だけなので、実行時のふるまいは変わらない
    context.weapons = weapons
      .filter((item) => item.isWeapon())
      .map((item) => ({
        // 保存済みの埋め込みドキュメントなので id は必ずある
        id: item.id!,
        name: item.name,
        img: item.img,
        rangeLabel: formatRangeLabel(item.system.rangeType, item.system.range),
        damagePreview: formatDamagePreview(item.system.damageDie, item.system.attackPower),
        equipped: item.system.equipped,
      }));

    const armors = (this.actor.itemTypes.armor ?? []) as EmokloreItem[];
    context.armors = armors
      .filter((item) => item.isArmor())
      .map((item) => ({
        id: item.id!,
        name: item.name,
        img: item.img,
        defense: item.system.defense,
        coverage: item.system.coverage,
        equipped: item.system.equipped,
      }));
  }

  private _prepareEffectsContext(context: CharacterContext): void {
    context.tab = context.tabs.effects;
    context.effects = prepareActiveEffectCategories(this.actor.allApplicableEffects());
  }

  /**
   * 消費した技能ポイント。
   *
   * カスタム技能も同じ表で数える。ベース技能はレベルを持たないので呼び出し側が除いてある。
   * エクストラ技能はコストが倍なので、`calculateTotalSkillPoints` の約束どおり
   * 全体と ex の両方に入れて2回数えさせる。
   */
  private _calculateSkillPointSumFromContext(
    skills: Record<string, SkillRow>,
    customSkills: CustomSkillRow[],
  ): number {
    const all = [...Object.values(skills), ...customSkills];
    return calculateTotalSkillPoints(
      all,
      all.filter((skill) => skill.isExtra),
    );
  }
}
