import type { ApplicationRenderContext } from "@client/applications/_types.mjs";
import type { HandlebarsRenderOptions } from "@client/applications/api/handlebars-application.mjs";
import type { EmokloreActor } from "../documents/actor";
import { importFromCharSheet, validateCharSheetJSON } from "../utils/charsheet-importer";

type CharSheetImportDialogContext = ApplicationRenderContext & {
  jsonInput: string;
  error?: string;
  success?: boolean;
};

/**
 * Dialog for importing character data from character sheet website JSON
 */
export class CharSheetImportDialog extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
) {
  static override DEFAULT_OPTIONS = {
    id: "charsheet-import-{id}",
    tag: "form",
    form: {
      handler: CharSheetImportDialog.onSubmit,
      closeOnSubmit: true,
    },
    window: {
      title: "EMOKLORE.Import.DialogTitle",
      icon: "fa-solid fa-file-import",
      resizable: true,
    },
    position: {
      width: 600,
      height: "auto",
    },
    actions: {
      import: CharSheetImportDialog.onImport,
    },
  };

  static override PARTS = {
    form: {
      template: "systems/emoklore/templates/apps/charsheet-import.hbs",
    },
  };

  actor: EmokloreActor;

  constructor(actor: EmokloreActor, options = {}) {
    super(options);
    this.actor = actor;
  }

  override async _prepareContext(
    _options: HandlebarsRenderOptions,
  ): Promise<CharSheetImportDialogContext> {
    return {
      jsonInput: "",
    };
  }

  static async onImport(this: CharSheetImportDialog, event: Event, _target: HTMLElement) {
    event.preventDefault();
    console.log("Import button clicked");

    // DEFAULT_OPTIONS の tag が "form" なので this.element 自体がフォーム要素になる
    const form = this.element.querySelector("form") ?? this.element;
    console.log("Element:", this.element);
    console.log("Form:", form);

    const textarea = form.querySelector<HTMLTextAreaElement>('textarea[name="jsonInput"]');

    console.log("Textarea:", textarea);

    const jsonInput = textarea?.value ?? "";

    console.log("JSON input length:", jsonInput?.length);

    if (!jsonInput || jsonInput.trim() === "") {
      ui.notifications?.error(game.i18n.localize("EMOKLORE.Import.ErrorEmptyInput"));
      return;
    }

    // Validate JSON
    const validation = validateCharSheetJSON(jsonInput);
    console.log("Validation result:", validation);

    if (!validation.valid) {
      const errorMsg = validation.error
        ? game.i18n.localize(validation.error)
        : game.i18n.localize("EMOKLORE.Import.ErrorInvalidJSON");

      ui.notifications?.error(errorMsg);
      return;
    }

    // Import the data
    try {
      console.log("Starting import...");
      await importFromCharSheet(this.actor, validation.data!);
      console.log("Import successful");
      this.close();
    } catch (error) {
      console.error("Character import error:", error);
      ui.notifications?.error(game.i18n.localize("EMOKLORE.Import.ErrorImportFailed"));
    }
  }

  static async onSubmit(_event: Event, _form: HTMLFormElement, _formData: any): Promise<void> {
    // This is called when the form is submitted via the import button
    // The actual import logic is handled by onImport
  }

  /**
   * Show the import dialog for an actor
   */
  static async show(actor: EmokloreActor): Promise<CharSheetImportDialog> {
    const dialog = new CharSheetImportDialog(actor);
    dialog.render(true);
    return dialog;
  }
}
