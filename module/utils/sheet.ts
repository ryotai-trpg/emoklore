/**
 * シートのDOMからFoundryのドキュメントを引くためのユーティリティ。
 * エモクロア固有のルールは持たない。
 */

export const getEmbeddedDocument = (target: HTMLElement, actor: any): any => {
  const docRow = target.closest("li[data-document-class]") as HTMLElement & {
    dataset: DOMStringMap;
  };

  if (docRow.dataset.documentClass === "Item") {
    return actor.items.get(docRow.dataset.itemId!);
  } else if (docRow.dataset.documentClass === "ActiveEffect") {
    const parent =
      docRow.dataset.parentId === actor.id ? actor : actor.items.get(docRow.dataset.parentId!);
    return parent?.effects.get(docRow.dataset.effectId!);
  } else {
    console.warn("Could not find document class");
    return null;
  }
};

export const createDocumentData = (
  target: HTMLElement & { dataset: DOMStringMap },
  actor: any,
): Record<string, any> => {
  const docCls = getDocumentClass(target.dataset.documentClass! as any) as any;

  const docData: Record<string, any> = {
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
