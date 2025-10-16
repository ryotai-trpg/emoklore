import constructHTMLButton from "../helpers/construct-html-button";
import { systemID } from "../constants";
const { HandlebarsApplicationMixin } = foundry.applications.api;

interface DocumentSheetOptions {
  classes: string[];
  actions: Record<string, (event: Event, target: HTMLElement) => Promise<void>>;
  window: {
    resizable: boolean;
  };
  form: {
    submitOnChange: boolean;
  };
}

interface DocumentSheetContext {
  isPlay: boolean;
  owner: boolean;
  limited: boolean;
  gm: boolean;
  document: any;
  system: any;
  systemFields: any;
  flags: any;
  [key: string]: unknown;
}

export default (base: any) => {
  return class EmokloreDocumentSheet extends HandlebarsApplicationMixin(base) {
    declare document: any;
    declare window: any;
    static DEFAULT_OPTIONS: DocumentSheetOptions = {
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

    async _prepareContext(options: Record<string, unknown>): Promise<DocumentSheetContext> {
      const context = await super._prepareContext(options) as DocumentSheetContext;

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

      if (game.settings.get(systemID as any, "developerMode" as any)) {
        console.log(context);
      }

      return context;
    }

    _configureRenderOptions(options: Record<string, unknown>): void {
      super._configureRenderOptions(options);
      if (options.mode && (this as any).isEditable) {
        this._mode = options.mode as number;
      }
      // New sheets should always start in edit mode
      else if (options.renderContext === `create${(this.document as any).documentName}`) {
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

    static async #toggleMode(event: Event, target: HTMLElement): Promise<void> {
      if (!(this as any).isEditable) {
        console.error("You can't switch to Edit mode if the sheet is uneditable");
        return;
      }
      (this as any)._mode = (this as any).isPlayMode
        ? EmokloreDocumentSheet.MODES.EDIT
        : EmokloreDocumentSheet.MODES.PLAY;
      (this as any).render();
    }
  };
};
