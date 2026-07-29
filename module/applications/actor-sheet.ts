import type { ApplicationRenderContext, ApplicationTab } from "@client/applications/_types.mjs";
import { isBaseSkillKey } from "../config/base-skills";
import { isSkillKey } from "../config/skills";
import type { SkillRef } from "../data/character-like";
import type { EmokloreActor } from "../documents/actor";
import { getSetting } from "../settings";
import {
  createDocumentData,
  getEmbeddedDocument,
  resolveEmbeddedDocumentClass,
} from "../utils/sheet";
import { promptCreateSkill } from "./dialogs/create-skill-dialog";
import EmokloreDocumentSheetMixin from "./document-sheet-mixin";
import { resolveSegmentValue } from "./helpers";
import { requestResonanceRoll, requestSkillRoll } from "./rolls";
import type {
  EmokloreActorSheetOptions,
  EmokloreRenderOptions,
  RowContextEntry,
  SheetEffect,
} from "./types";

/** 行として並ぶ埋め込みドキュメントのセレクタ。右クリックメニューと解決の口を揃える */
const ROW_SELECTOR = "[data-document-class][data-item-id], [data-document-class][data-effect-id]";

/**
 * `foundry.utils.performIntegerSort` の戻り値。
 *
 * 本体のJSDocは `object[]` としか宣言していないので、実際に読む形だけを書く
 * （`client/utils/helpers.mjs` のコメントに構造が書いてある）。
 */
type SortUpdate = { target: { id: string | null }; update: Record<string, unknown> };

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
      viewDoc: this._viewDoc,
      createDoc: this._createDoc,
      deleteDoc: this._deleteDoc,
      toggleEffect: this._toggleEffect,
      toggleEquipped: this._toggleEquipped,
      selectSegment: this._selectSegment,
      createSkill: this._createSkill,
    },
  };

  // タブナビのパート。本体のテンプレートなので systemPath を通さない。
  // 各シートの PARTS はクラスごとに丸ごと宣言し直す決まり（HandlebarsApplicationMixin は
  // PARTS を継承マージしない）ので、パスをここに置いて写し間違いを防ぐ
  static readonly TAB_NAV_PART = { template: "templates/generic/tab-navigation.hbs" };

  /**
   * 行の埋め込みドキュメントを開く・作る・消す。
   *
   * **どのアクターシートでも同じ操作なので基底が持つ。** 行の解決は `utils/sheet.ts` の
   * `getEmbeddedDocument` に任せる — アイテムと効果のどちらも引けるので、種別ごとに
   * `data-item-id` を手で辿る必要がない（右クリックメニューも同じ関数を通っている）。
   */
  static async _viewDoc(this: EmokloreActorSheet, _event: Event, target: HTMLElement) {
    getEmbeddedDocument(target, this.actor)?.sheet?.render(true);
  }

  static async _deleteDoc(this: EmokloreActorSheet, _event: Event, target: HTMLElement) {
    await getEmbeddedDocument(target, this.actor)?.delete();
  }

  static async _createDoc(
    this: EmokloreActorSheet,
    _event: Event,
    target: HTMLElement & { dataset: DOMStringMap },
  ) {
    const docData = createDocumentData(target, this.actor);
    const docCls = resolveEmbeddedDocumentClass(target.dataset.documentClass);
    await docCls.create(docData, { parent: this.actor });
  }

  static async _toggleEffect(this: EmokloreActorSheet, _event: Event, target: HTMLElement) {
    const effect = getEmbeddedDocument(target, this.actor);
    if (effect) await effect.update({ disabled: !effect.disabled });
  }

  /**
   * アイテムタブの装備チェックボックス。
   *
   * アイテムの値の編集だがシートのフォームには載せられない（同じ name の入力を
   * 2箇所に描けない）ので、name を持たないチェックボックスから直接アイテムへ書く。
   */
  static async _toggleEquipped(this: EmokloreActorSheet, _event: Event, target: HTMLElement) {
    const item = getEmbeddedDocument(target, this.actor);
    if (item) await item.update({ "system.equipped": (target as HTMLInputElement).checked });
  }

  /**
   * カスタム技能を作る。
   *
   * `createDoc` は dataset をそのまま作成データに載せる汎用の口だが、技能は名前と
   * 参照能力値が決まっていないと行を描けないので、先にダイアログで尋ねる。
   * 「尋ねるかどうか」はプレゼンテーションの決定なので applications 側に置く。
   */
  static async _createSkill(this: EmokloreActorSheet, event: Event, _target: HTMLElement) {
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
  static async _selectSegment(this: EmokloreActorSheet, event: Event, target: HTMLElement) {
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
   * タブに属するパートへ自分のタブ情報を渡す（`class="tab"` の active 付けに使う）。
   *
   * `context.tabs` は `TABS` を1グループ宣言したシートで本体の `_prepareContext` が積む。
   * タブを持たないシートでは無いので何もしない。
   */
  override async _preparePartContext(
    partId: string,
    context: ApplicationRenderContext & { tabs?: Record<string, ApplicationTab>; tab?: unknown },
    options: EmokloreRenderOptions,
  ): Promise<ApplicationRenderContext> {
    await super._preparePartContext(partId, context, options);
    if (context.tabs && partId in context.tabs) context.tab = context.tabs[partId];
    return context;
  }

  /**
   * 行の右クリックメニューを張る。
   *
   * **`_onRender` ではなく初回描画で1回だけ。** `ContextMenu` はコンストラクタで
   * container に直接リスナを足す（`ux/context-menu.mjs`）ので、描画のたびに作ると
   * リスナが積み上がる。container は再描画で差し替わらないルート要素にしてある。
   *
   * `_createContextMenu` を通すと `jQuery: false` と `get...ContextOptions` フックが
   * 付いてくる。`ContextMenu.create` は ApplicationV2 に対して例外を投げるので使えない。
   */
  override async _onFirstRender(
    context: ApplicationRenderContext,
    options: EmokloreRenderOptions,
  ): Promise<void> {
    await super._onFirstRender(context, options);

    this._createContextMenu(this.#rowContextOptions, ROW_SELECTOR, {
      hookName: "getEmokloreRowContextOptions",
      parentClassHooks: false,
      // `fixed` は本体JSDocのオプション型に無いが、残りはそのまま ContextMenu の
      // コンストラクタへ渡る。タブは overflow: auto なので、注入方式だと切られる
      ...({ fixed: true } as { container?: HTMLElement }),
    });
  }

  /**
   * 行のメニュー項目。
   *
   * **モードでは絞らず、権限だけで絞る。** 行のアイコンを閲覧モードで隠すのは誤爆を
   * 防ぐためで、操作そのものを封じるためではない（dnd5e・draw-steel・ryuutama も同じ
   * 割り切り）。`visible` は開くたびに評価されるので、権限の変化にも追従する。
   */
  #rowContextOptions(this: EmokloreActorSheet): RowContextEntry[] {
    const resolve = (target: HTMLElement) => getEmbeddedDocument(target, this.actor);

    return [
      {
        label: "EMOKLORE.Sheet.rowMenu.Open",
        icon: "fa-solid fa-eye",
        onClick: (_event, target) => {
          resolve(target)?.sheet?.render(true);
        },
      },
      {
        label: "EMOKLORE.Sheet.rowMenu.Delete",
        icon: "fa-solid fa-trash",
        visible: () => this.isEditable,
        onClick: (_event, target) => {
          void resolve(target)?.delete();
        },
      },
    ];
  }

  override async _onRender(
    context: ApplicationRenderContext,
    options: EmokloreRenderOptions,
  ): Promise<void> {
    await super._onRender(context, options);

    // 行ごとドラッグできるので、行の中の入力欄はそのままだとドラッグに吸われる。
    // 装備チェックを押そうとしてポインタがわずかに動くだけでドラッグが始まり、
    // クリックが届かなくなる。要素側で dragstart を止めて行に伝えない
    for (const input of this.element.querySelectorAll<HTMLElement>(
      ".draggable :is(input, select, textarea)",
    )) {
      input.draggable = true;
      input.ondragstart = (event) => {
        event.preventDefault();
        event.stopPropagation();
      };
    }
  }

  /**
   * ドラッグを始められるか。**閲覧モードでは始めさせない。**
   *
   * 本体の既定は常に `true` で、参考システムもそこを触っていない（閲覧者にもシート外への
   * 持ち出しを許す設計）。ここだけ外しているのは、卓中に行を触るたびドラッグが始まって
   * クリックが消えるのを避けるため。持ち出したいときは編集モードに切り替える。
   *
   * `DragDrop#bind()` が `draggable` 属性を書くのは bind の時点なので、モードを
   * 切り替えると再描画 → 再bind で追従する。
   *
   * `ActorSheetV2` のメソッドだが、mixin の返り値の型が ApplicationV2 ベースで
   * 本体のシグネチャが見えないため `override` は書けない（`actor` の `declare` と同じ事情）。
   */
  _canDragStart(_selector: string): boolean {
    return this.isEditMode;
  }

  /**
   * 効果の行を落としたとき。
   *
   * **本体は同じアクターへのドロップを黙って捨てる**（`ActorSheetV2#_onDropActiveEffect` が
   * `[effect.parent, effect.parent?.parent].includes(actor)` で `null` を返す）。複製を防ぐ
   * ための判定だが、そのぶん同一アクター内での並び替えも起きない。並び替えをここで拾う。
   *
   * 並べ替えられるのは**アクター直下の効果どうし**だけ。アイテムに乗った効果は親が違うので、
   * `sort` を書いても同じ列の中では比較されない。
   *
   * `super` を呼ばず本体と同じ分岐を書き直しているのは、mixin の返り値の型が
   * ApplicationV2 ベースで `ActorSheetV2` のメソッドが見えないため（`_canDragStart` と同じ事情）。
   * 複製の判定と結果は本体に揃えてある。
   */
  async _onDropActiveEffect(event: DragEvent, effect: SheetEffect): Promise<unknown> {
    if (!this.actor.isOwner || !this.isEditable) return null;

    const dropTarget = (event.target as HTMLElement | null)?.closest<HTMLElement>(
      "[data-effect-id]",
    );
    const ownedByActor =
      effect.parent === this.actor && dropTarget?.dataset.parentId === this.actor.id;

    if (dropTarget && ownedByActor) return this.#sortEffects(dropTarget, effect);

    // 自分（またはその配下のアイテム）が持つ効果は複製しない
    const grandparent = (effect.parent as { parent?: unknown } | null)?.parent;
    if (effect.parent === this.actor || grandparent === this.actor) return null;

    return (
      (await resolveEmbeddedDocumentClass("ActiveEffect").create(effect.toObject(), {
        parent: this.actor,
      })) ?? null
    );
  }

  /** 落とした先の兄弟を DOM から集めて `sort` を振り直す。本体の `_onSortItem` と同じ手順 */
  async #sortEffects(dropTarget: HTMLElement, effect: SheetEffect): Promise<unknown> {
    const target = this.actor.effects.get(dropTarget.dataset.effectId ?? "");
    if (!target || target.id === effect.id) return null;

    const siblings = [];
    for (const element of dropTarget.parentElement?.children ?? []) {
      const id = (element as HTMLElement).dataset.effectId;
      if (id && id !== effect.id) {
        const sibling = this.actor.effects.get(id);
        if (sibling) siblings.push(sibling);
      }
    }

    const sorted = foundry.utils.performIntegerSort(effect, { target, siblings }) as SortUpdate[];
    const updates = sorted.map((entry) => ({
      ...entry.update,
      // biome-ignore lint/style/useNamingConvention: 本体の updateEmbeddedDocuments が _id を要求する
      _id: entry.target.id,
    }));

    return this.actor.updateEmbeddedDocuments("ActiveEffect", updates);
  }

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
