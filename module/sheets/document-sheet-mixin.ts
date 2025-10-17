import constructHTMLButton from "../helpers/construct-html-button";
import { systemID } from "../constants";
import { getSetting } from "../settings";
import type { EmokloreDocumentSheetOptions, EmokloreDocumentSheetContext } from "./types";
const { HandlebarsApplicationMixin } = foundry.applications.api;

export default (base: any) => {
  return class EmokloreDocumentSheet extends HandlebarsApplicationMixin(base) {
    declare document: any;
    declare window: any;
    static DEFAULT_OPTIONS: EmokloreDocumentSheetOptions = {
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

    async _prepareContext(options: Record<string, unknown>): Promise<EmokloreDocumentSheetContext> {
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

    _configureRenderOptions(options: Record<string, unknown>): void {
      super._configureRenderOptions(options);
      if (options.mode && this.isEditable) {
        this._mode = options.mode as number;
      }
      // New sheets should always start in edit mode
      else if (options.renderContext === `create${this.document.documentName}`) {
        this._mode = EmokloreDocumentSheet.MODES.EDIT;
      }
    }

    async _renderFrame(options: Record<string, unknown>): Promise<HTMLElement> {
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
      event: Event,
      target: HTMLElement,
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
