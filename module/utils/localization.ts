/* -------------------------------------------- */
/*  Config Pre-Localization                     */
/* -------------------------------------------- */

// Adapted from dnd5e and draw-steel

// export function sortObjectEntries(obj, sortKey) {
export function sortObjectEntries<T extends Record<string, unknown>, V = T[keyof T]>(
  obj: T,
  sortKey?: string | ((a: V, b: V) => number),
): T {
  let sorted = Object.entries(obj) as [string, V][];

  const compareValues = (lhs: unknown, rhs: unknown): number => {
    if (typeof lhs === "string" && typeof rhs === "string") {
      return lhs.localeCompare(rhs, game.i18n.lang);
    }
    const ln = Number(lhs);
    const rn = Number(rhs);
    if (!Number.isNaN(ln) && !Number.isNaN(rn)) return ln - rn;
    return 0;
  };

  if (typeof sortKey === "function") {
    sorted = sorted.sort((lhs, rhs) => sortKey(lhs[1], rhs[1]));
  } else if (typeof sortKey === "string") {
    sorted = sorted.sort((lhs, rhs) => {
      const lval = (lhs[1] as Record<string, unknown> | unknown as Record<string, unknown>)[
        sortKey as string
      ];
      const rval = (rhs[1] as Record<string, unknown> | unknown as Record<string, unknown>)[
        sortKey as string
      ];
      return compareValues(lval, rval);
    });
  } else {
    sorted = sorted.sort((lhs, rhs) => compareValues(lhs[1], rhs[1]));
  }

  return Object.fromEntries(sorted) as T;
}

/* -------------------------------------------------- */

/**
 * Storage for pre-localization configuration.
 * @type {object}
 * @private
 */
type PreLocalizationRegistration = {
  keys: string[];
  sort: boolean;
};

const _preLocalizationRegistrations: Record<string, PreLocalizationRegistration> = {};

/* -------------------------------------------------- */

export function preLocalize(
  configKeyPath: string,
  { key, keys = [], sort = false }: { key?: string; keys?: string[]; sort?: boolean } = {},
) {
  if (key) keys.unshift(key);
  _preLocalizationRegistrations[configKeyPath] = { keys, sort };
}

/* -------------------------------------------------- */

export function performPreLocalization(config: Record<string, unknown>) {
  for (const [keyPath, settings] of Object.entries(_preLocalizationRegistrations)) {
    const target = foundry.utils.getProperty(config, keyPath);
    if (!target) continue;
    _localizeObject(target as Record<string, unknown>, settings.keys);
    if (settings.sort)
      foundry.utils.setProperty(
        config,
        keyPath,
        sortObjectEntries(target as Record<string, unknown>, settings.keys[0]),
      );
  }

  // Localize & sort status effects
  // CONFIG.statusEffects.forEach(s => s.name = game.i18n.localize(s.name));
  // CONFIG.statusEffects.sort((lhs, rhs) =>
  //   lhs.id === "dead" ? -1 : rhs.id === "dead" ? 1 : lhs.name.localeCompare(rhs.name, game.i18n.lang),
  // );
}

/* -------------------------------------------------- */

function _localizeObject(obj: Record<string, unknown>, keys?: string[]): void {
  for (const [k, v] of Object.entries(obj)) {
    const type = typeof v;
    if (type === "string") {
      obj[k] = game.i18n.localize(v as string);
      continue;
    }

    if (type !== "object") {
      console.error(
        new Error(
          `Pre-localized configuration values must be a string or object, ${type} found for "${k}" instead.`,
        ),
      );
      continue;
    }
    if (!keys?.length) {
      console.error(
        new Error(
          "Localization keys must be provided for pre-localizing when target is an object.",
        ),
      );
      continue;
    }

    for (const key of keys) {
      const value = foundry.utils.getProperty(v as Record<string, unknown>, key);
      if (typeof value !== "string") continue;
      foundry.utils.setProperty(v as Record<string, unknown>, key, game.i18n.localize(value));
    }
  }
}
