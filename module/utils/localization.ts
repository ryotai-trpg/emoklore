/* -------------------------------------------- */
/*  Config Pre-Localization                     */
/* -------------------------------------------- */

// Adapted from dnd5e and draw-steel

/**
 * Storage for pre-localization configuration.
 * @type {object}
 * @private
 */
type PreLocalizationRegistration = {
  keys: string[];
};

const _preLocalizationRegistrations: Record<string, PreLocalizationRegistration> = {};

/* -------------------------------------------------- */

export function preLocalize(
  configKeyPath: string,
  { key, keys = [] }: { key?: string; keys?: string[] } = {},
) {
  if (key) keys.unshift(key);
  _preLocalizationRegistrations[configKeyPath] = { keys };
}

/* -------------------------------------------------- */

export function performPreLocalization(config: Record<string, unknown>) {
  for (const [keyPath, settings] of Object.entries(_preLocalizationRegistrations)) {
    const target = foundry.utils.getProperty(config, keyPath);
    if (!target) continue;
    _localizeObject(target as Record<string, unknown>, settings.keys);
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
