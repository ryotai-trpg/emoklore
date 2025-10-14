import { systemID } from "./constants";

export function registerSystemSettings() {
  // @ts-expect-error
  game.settings.register(systemID, "developerMode", {
    name: "SETTINGS.EMOKLORE.DeveloperMode.Name",
    hint: "SETTINGS.EMOKLORE.DeveloperMode.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    requiresReload: true,
  });
}
