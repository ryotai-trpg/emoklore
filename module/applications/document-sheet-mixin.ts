import { getSetting } from "../settings";
import type {
  EmokloreDocumentSheetContext,
  EmokloreDocumentSheetOptions,
  EmokloreRenderOptions,
  SheetDocument,
} from "./types";

const { HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * 本体の HandlebarsApplicationMixin と同じ制約（`@param {Constructor<ApplicationV2>}`）。
 *
 * コンストラクタ引数はサブクラスごとに異なるため、mixinの制約としては any[] にするしかない
 * （unknown[] だと引数を持つクラスを受け付けられない）。
 */
// biome-ignore lint/suspicious/noExplicitAny: mixinのコンストラクタ制約には any[] が必要
type ApplicationV2Constructor = new (...args: any[]) => foundry.applications.api.ApplicationV2;

// base を any にすると extends any になり、このファイル全体の型チェックが効かなくなる
export default (base: ApplicationV2Constructor) => {
  return class EmokloreDocumentSheet extends HandlebarsApplicationMixin(base) {
    declare document: SheetDocument;
    // DocumentSheetV2のgetterだが、mixinの型（typeof ApplicationV2ベース）からは見えないため補強
    declare readonly isEditable: boolean;
    static override DEFAULT_OPTIONS: EmokloreDocumentSheetOptions = {
      classes: ["emoklore"],
      actions: {
        toggleMode: this.#toggleMode,
      },
      window: {
        resizable: true,
      },
      form: {
        submitOnChange: true,
      },
    };

    override async _prepareContext(
      options: EmokloreRenderOptions,
    ): Promise<EmokloreDocumentSheetContext> {
      const context = (await super._prepareContext(options)) as EmokloreDocumentSheetContext;

      Object.assign(context, {
        isPlay: this.isPlayMode,
        owner: this.document.isOwner,
        limited: this.document.limited,
        gm: game.user?.isGM ?? false,
        document: this.document,
        system: this.document.system,
        systemFields: this.document.system.schema.fields,
        flags: this.document.flags,
      });

      if (getSetting("developerMode")) {
        console.log(context);
      }

      return context;
    }

    override _configureRenderOptions(options: EmokloreRenderOptions): void {
      super._configureRenderOptions(options);
      if (options.mode && this.isEditable) {
        this._mode = options.mode;
      }
      // New sheets should always start in edit mode
      else if (options.renderContext === `create${this.document.documentName}`) {
        this._mode = EmokloreDocumentSheet.MODES.EDIT;
      }
    }

    override async _renderFrame(options: EmokloreRenderOptions): Promise<HTMLElement> {
      const frame = await super._renderFrame(options);

      // 閲覧/編集を切り替えるボタンを、本体のウィンドウ操作列の後ろに足す
      const toggleMode = document.createElement("button");
      toggleMode.type = "button";
      toggleMode.classList.add("header-control", "icon", "fa-solid", "fa-user-lock");
      toggleMode.dataset.action = "toggleMode";
      toggleMode.dataset.tooltip = "EMOKLORE.SHEET.ToggleMode";
      this.window.controls.after(toggleMode);

      return frame;
    }

    static readonly MODES = Object.freeze({
      PLAY: 1,
      EDIT: 2,
    } as const);

    _mode: number = EmokloreDocumentSheet.MODES.PLAY;

    get isPlayMode(): boolean {
      return this._mode === EmokloreDocumentSheet.MODES.PLAY;
    }

    get isEditMode(): boolean {
      return this._mode === EmokloreDocumentSheet.MODES.EDIT;
    }

    static async #toggleMode(
      this: EmokloreDocumentSheet,
      _event: Event,
      _target: HTMLElement,
    ): Promise<void> {
      if (!this.isEditable) {
        console.error("You can't switch to Edit mode if the sheet is uneditable");
        return;
      }
      this._mode = this.isPlayMode
        ? EmokloreDocumentSheet.MODES.EDIT
        : EmokloreDocumentSheet.MODES.PLAY;
      this.render();
    }
  };
};
