import { getSetting } from "../settings";
import constructHTMLButton from "../utils/construct-html-button";
import type {
  EmokloreDocumentSheetContext,
  EmokloreDocumentSheetOptions,
  EmokloreRenderOptions,
} from "./types";

const { HandlebarsApplicationMixin } = foundry.applications.api;

/** 本体の HandlebarsApplicationMixin と同じ制約（`@param {Constructor<ApplicationV2>}`） */
type ApplicationV2Constructor = new (...args: any[]) => foundry.applications.api.ApplicationV2;

/**
 * シートが参照するドキュメントのメンバー。
 *
 * 本体の ClientDocumentMixin はJSDocがジェネリクスを消しているため、
 * これらが Document の型に出てこない。utils/effects.ts と同じく、
 * 実際に使うものだけを交差型で補う。
 */
type SheetDocument = foundry.abstract.Document & {
  isOwner: boolean;
  limited: boolean;
  documentName: string;
  system: { schema: { fields: Record<string, foundry.data.fields.DataField> } };
  flags: Record<string, unknown>;
};

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
        gm: game.user.isGM,
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
      const buttons = [
        constructHTMLButton({
          label: "",
          classes: ["header-control", "icon", "fa-solid", "fa-user-lock"],
          dataset: {
            action: "toggleMode",
            tooltip: "EMOKLORE.SHEET.ToggleMode",
          },
        }),
      ];

      this.window.controls.after(...buttons);

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
