/**
 * シートのDOMからFoundryのドキュメントを引くためのユーティリティ。
 * エモクロア固有のルールは持たない。
 */

import type { EmokloreActor } from "../documents/actor";

/**
 * シートから操作する埋め込みドキュメント（Item / ActiveEffect）。
 *
 * ClientDocumentMixin 由来のメンバーは本体JSDocのジェネリクス消失で
 * Document の型に出てこないため、実際に使うものだけを交差型で補う。
 */
export type EmbeddedSheetDocument = foundry.abstract.Document & {
  sheet: { render: (force?: boolean) => void } | null;
  delete: () => Promise<unknown>;
  update: (data: Record<string, unknown>) => Promise<unknown>;
  /** ActiveEffect のみ持つ */
  disabled?: boolean;
};

export const getEmbeddedDocument = (
  target: HTMLElement,
  actor: EmokloreActor,
): EmbeddedSheetDocument | null => {
  const docRow = target.closest("li[data-document-class]") as HTMLElement & {
    dataset: DOMStringMap;
  };

  // ClientDocumentMixin 由来のメンバーを使うため、コレクションから取り出す境界で1回だけ絞る
  const asSheetDocument = (doc: unknown): EmbeddedSheetDocument | null =>
    (doc as EmbeddedSheetDocument) ?? null;

  if (docRow.dataset.documentClass === "Item") {
    return asSheetDocument(actor.items.get(docRow.dataset.itemId!));
  } else if (docRow.dataset.documentClass === "ActiveEffect") {
    const parent =
      docRow.dataset.parentId === actor.id ? actor : actor.items.get(docRow.dataset.parentId!);
    return asSheetDocument(parent?.effects.get(docRow.dataset.effectId!));
  } else {
    console.warn("Could not find document class");
    return null;
  }
};

/** シートが埋め込みドキュメントとして扱えるもの */
type EmbeddedDocumentName = "Item" | "ActiveEffect";

/**
 * シートから作成する際に使うDocumentのstatic。
 *
 * どちらも ClientDocumentMixin 由来で、本体JSDocのジェネリクス消失により
 * `getDocumentClass` の戻り値の型には出てこない。
 */
type EmbeddedDocumentClass = {
  defaultName: (options: { type?: string | undefined; parent?: unknown }) => string;
  create: (data: Record<string, unknown>, options?: Record<string, unknown>) => Promise<unknown>;
};

/**
 * `data-document-class` の文字列からドキュメントクラスを引く。
 *
 * datasetは任意の文字列が来うるので、扱える種類かどうかをここで確かめる。
 */
export const resolveEmbeddedDocumentClass = (
  documentClass: string | undefined,
): EmbeddedDocumentClass => {
  if (documentClass !== "Item" && documentClass !== "ActiveEffect") {
    throw new Error(`emoklore | 未対応の data-document-class: ${documentClass}`);
  }
  const cls = getDocumentClass(documentClass satisfies EmbeddedDocumentName);
  // biome-ignore lint: ClientDocumentMixin のstaticが本体の型に出ないため素の as では通らない
  return cls as unknown as EmbeddedDocumentClass;
};

export const createDocumentData = (
  target: HTMLElement & { dataset: DOMStringMap },
  actor: EmokloreActor,
): Record<string, unknown> => {
  const docCls = resolveEmbeddedDocumentClass(target.dataset.documentClass);

  const docData: Record<string, unknown> = {
    name: docCls.defaultName({
      type: target.dataset.type,
      parent: actor,
    }),
  };

  // Loop through the dataset and add it to our docData
  for (const [dataKey, value] of Object.entries(target.dataset)) {
    // These data attributes are reserved for the action handling
    if (["action", "documentClass"].includes(dataKey)) continue;
    // Nested properties require dot notation in the HTML, e.g. anything with `system`
    // An example exists in spells.hbs, with `data-system.spell-level`
    // which turns into the dataKey 'system.spellLevel'
    foundry.utils.setProperty(docData, dataKey, value);
  }

  return docData;
};
