import { importFromCharSheet, validateCharSheetJSON } from "../helpers/charsheet-importer";
import type { EmokloreActor } from "../documents/actor";

interface CharSheetImportDialogContext {
  jsonInput: string;
  error?: string;
  success?: boolean;
}

declare const foundry: any;

/**
 * Dialog for importing character data from character sheet website JSON
 */
export class CharSheetImportDialog extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
) {
  static DEFAULT_OPTIONS = {
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

  static PARTS = {
    form: {
      template: "systems/emoklore/templates/apps/charsheet-import.hbs",
    },
  };

  actor: EmokloreActor;

  constructor(actor: EmokloreActor, options = {}) {
    super(options);
    this.actor = actor;
  }

  async _prepareContext(_options: any): Promise<CharSheetImportDialogContext> {
    return {
      jsonInput: "",
    };
  }

  static async onImport(this: CharSheetImportDialog, event: Event, target: HTMLElement) {
    event.preventDefault();
    console.log("Import button clicked");

    // Get the form - it might be the element itself or we need to find it differently
    const form = (this as any).element?.querySelector("form") || (this as any).element;
    console.log("Element:", (this as any).element);
    console.log("Form:", form);
    
    if (!form) {
      console.error("Form not found");
      return;
    }

    // Try to get the textarea directly
    const textarea = form.querySelector('textarea[name="jsonInput"]') || 
                     (this as any).element?.querySelector('textarea[name="jsonInput"]');
    
    console.log("Textarea:", textarea);
    
    const jsonInput = textarea?.value || "";
    
    console.log("JSON input length:", jsonInput?.length);

    if (!jsonInput || jsonInput.trim() === "") {
      (globalThis as any).ui.notifications?.error(
        (globalThis as any).game.i18n.localize("EMOKLORE.Import.ErrorEmptyInput"),
      );
      return;
    }

    // Validate JSON
    const validation = validateCharSheetJSON(jsonInput);
    console.log("Validation result:", validation);

    if (!validation.valid) {
      const errorMsg = validation.error
        ? (globalThis as any).game.i18n.localize(validation.error)
        : (globalThis as any).game.i18n.localize("EMOKLORE.Import.ErrorInvalidJSON");

      (globalThis as any).ui.notifications?.error(errorMsg);
      return;
    }

    // Import the data
    try {
      console.log("Starting import...");
      await importFromCharSheet(this.actor, validation.data!);
      console.log("Import successful");
      (this as any).close();
    } catch (error) {
      console.error("Character import error:", error);
      (globalThis as any).ui.notifications?.error(
        (globalThis as any).game.i18n.localize("EMOKLORE.Import.ErrorImportFailed"),
      );
    }
  }

  static async onSubmit(
    event: Event,
    form: HTMLFormElement,
    formData: any,
  ): Promise<void> {
    // This is called when the form is submitted via the import button
    // The actual import logic is handled by onImport
  }

  /**
   * Show the import dialog for an actor
   */
  static async show(actor: EmokloreActor): Promise<CharSheetImportDialog> {
    const dialog = new CharSheetImportDialog(actor);
    (dialog as any).render(true);
    return dialog;
  }
}
