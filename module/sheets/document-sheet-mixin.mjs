import constructHTMLButton from "../helpers/construct-html-button.mjs";
const { HandlebarsApplicationMixin } = foundry.applications.api;

export default base => {
  return class EmokloreDocumentSheet extends HandlebarsApplicationMixin(base) {

    static DEFAULT_OPTIONS = {
      classes: ["emoklore"],
      actions: {
        toggleMode: this.#toggleMode,
      },
      window: {
        resizable: true
      },
      form: {
        submitOnChange: true
      }
    };

    async _prepareContext(options) {
      const context = await super._prepareContext(options);

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

      if (game.settings.get("emoklore", "developerMode")) {
        console.log(context);
      }

      return context;
    }

    _configureRenderOptions(options) {
      super._configureRenderOptions(options);
      if (options.mode && this.isEditable) this._mode = options.mode;
      // New sheets should always start in edit mode
      else if (options.renderContext === `create${this.document.documentName}`) this._mode = EmokloreDocumentSheet.MODES.EDIT;
    }

    async _renderFrame(options) {
      const frame = await super._renderFrame(options);
      const buttons = [constructHTMLButton({
        label: "",
        classes: ["header-control", "icon", "fa-solid", "fa-user-lock"],
        dataset: { action: "toggleMode", tooltip: "EMOKLORE.SHEET.ToggleMode" },
      })];

      this.window.controls.after(...buttons);

      return frame;
    }

    static MODES = Object.freeze({
      PLAY: 1,
      EDIT: 2,
    });

    _mode = EmokloreDocumentSheet.MODES.PLAY;

    get isPlayMode() {
      return this._mode === EmokloreDocumentSheet.MODES.PLAY;
    }

    get isEditMode() {
      return this._mode === EmokloreDocumentSheet.MODES.EDIT;
    }

    static async #toggleMode(event, target) {
      if (!this.isEditable) {
        console.error("You can't switch to Edit mode if the sheet is uneditable");
        return;
      }
      this._mode = this.isPlayMode ? EmokloreDocumentSheet.MODES.EDIT : EmokloreDocumentSheet.MODES.PLAY;
      this.render();
    }
  }
}
