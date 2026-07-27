import type { ApplicationRenderContext } from "@client/applications/_types.mjs";
import type { HandlebarsRenderOptions } from "@client/applications/api/handlebars-application.mjs";
import { systemPath } from "../constants";
import type { EmokloreActor } from "../documents/actor";
import { validateCharSheetJSON } from "../utils/charsheet-importer";
import type { ApplicationV2Statics } from "./types";

const { HandlebarsApplicationMixin } = foundry.applications.api;

type CharSheetImportDialogContext = ApplicationRenderContext & {
  jsonInput: string;
  error?: string;
  success?: boolean;
};

/**
 * キャラクター保管所のJSONを貼り付けて取り込むダイアログ
 */
export class CharSheetImportDialog extends (HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
) as ReturnType<typeof HandlebarsApplicationMixin> & ApplicationV2Statics) {
  static override DEFAULT_OPTIONS = {
    id: "charsheet-import-{id}",
    // emoklore は変数の定義スコープ、charsheet-import-dialog はこのダイアログの
    // スタイルのスコープ。どちらもルート要素に付く。
    // standard-form は必須。本体の .form-group / .form-footer / fieldset の規則は
    // すべて .standard-form の子孫にスコープされていて、これがないと一切効かない
    classes: ["emoklore", "standard-form", "charsheet-import-dialog"],
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
      template: systemPath("templates/apps/charsheet-import.hbs"),
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

    // DEFAULT_OPTIONS の tag が "form" なので this.element 自体がフォーム要素になる
    const form = this.element.querySelector("form") ?? this.element;
    const textarea = form.querySelector<HTMLTextAreaElement>('textarea[name="jsonInput"]');
    const jsonInput = textarea?.value ?? "";

    if (!jsonInput || jsonInput.trim() === "") {
      ui.notifications?.error("EMOKLORE.Import.ErrorEmptyInput", { localize: true });
      return;
    }

    // 形が妥当かを先に見る
    const validation = validateCharSheetJSON(jsonInput);

    if (!validation.valid) {
      ui.notifications?.error(validation.error, { localize: true });
      return;
    }

    // 取り込む
    try {
      await this.actor.importFromCharSheet(validation.data);
      this.close();
    } catch (error) {
      console.error("emoklore | キャラクターの取り込みに失敗しました", error);
      ui.notifications?.error("EMOKLORE.Import.ErrorImportFailed", { localize: true });
    }
  }

  static async onSubmit(_event: Event, _form: HTMLFormElement, _formData: unknown): Promise<void> {
    // tag が "form" なので本体がsubmitハンドラを要求するが、取り込み自体は
    // onImport が済ませているのでここですることはない
  }

  /**
   * 指定したアクターに対してダイアログを開く
   */
  static async show(actor: EmokloreActor): Promise<CharSheetImportDialog> {
    const dialog = new CharSheetImportDialog(actor);
    dialog.render(true);
    return dialog;
  }
}
