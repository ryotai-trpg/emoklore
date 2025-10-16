import { systemID } from "./constants";

export function registerSystemSettings() {
  game.settings.register(systemID as any, "developerMode" as any, {
    name: "SETTINGS.EMOKLORE.DeveloperMode.Name",
    hint: "SETTINGS.EMOKLORE.DeveloperMode.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    requiresReload: true,
  });
}
