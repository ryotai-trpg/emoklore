import { systemID } from "./constants";

type EmokloreSettingKeys = "developerMode";

interface EmokloreSettings {
  developerMode: boolean;
}

export function registerSystemSettings(): void {
  (game.settings as any).register(systemID, "developerMode", {
    name: "SETTINGS.EMOKLORE.DeveloperMode.Name",
    hint: "SETTINGS.EMOKLORE.DeveloperMode.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    requiresReload: true,
  });
}

export function getSetting<K extends keyof EmokloreSettings>(key: K): EmokloreSettings[K] {
  return (game.settings as any).get(systemID, key) as EmokloreSettings[K];
}

export function setSetting<K extends keyof EmokloreSettings>(
  key: K,
  value: EmokloreSettings[K],
): Promise<EmokloreSettings[K]> {
  return (game.settings as any).set(systemID, key, value) as Promise<EmokloreSettings[K]>;
}
