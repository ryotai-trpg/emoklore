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

/** `enrichHTML` に渡せるドキュメント。アクターでもアイテムでも同じ形で足りる */
type EnrichSource = {
  isOwner: boolean;
  getRollData: () => Record<string, unknown>;
};

/**
 * `system.json` の `htmlFields` に宣言したリッチテキストを、描画できる形にする。
 *
 * `@UUID` リンクやインラインロールは保存時には解決されないので、描く直前に通す。
 * 渡すオプションはドキュメントの種別によらず同じなので、ここに1本だけ置く。
 */
export const enrichDocumentHTML = (doc: EnrichSource, value: string): Promise<string> =>
  foundry.applications.ux.TextEditor.implementation.enrichHTML(value, {
    secrets: doc.isOwner,
    relativeTo: doc,
    rollData: doc.getRollData(),
  });

export const getEmbeddedDocument = (
  target: HTMLElement,
  actor: EmokloreActor,
): EmbeddedSheetDocument | null => {
  // 要素名は問わない。アイテムタブと効果タブは li だが、技能タブの行は
  // 技能一覧の subgrid に載るため li にできない
  const docRow = target.closest("[data-document-class]") as HTMLElement & {
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
    console.warn(`emoklore | 未対応の data-document-class: ${docRow.dataset.documentClass}`);
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

  // dataset の中身をそのまま作成データに載せる
  for (const [dataKey, value] of Object.entries(target.dataset)) {
    // この2つはアクションの解決に使う予約語なので載せない
    if (["action", "documentClass"].includes(dataKey)) continue;
    // 入れ子のプロパティはHTML側でドット記法で書く（`data-system.foo` → `system.foo`）
    foundry.utils.setProperty(docData, dataKey, value);
  }

  return docData;
};
