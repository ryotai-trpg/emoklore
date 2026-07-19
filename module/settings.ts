import { systemID } from "./constants";

interface EmokloreSettings {
  developerMode: boolean;
  developerActorId: string;
}

/**
 * `game.settings.register` の第3引数として実際に渡すもの。
 *
 * 本体JSDocの `SettingConfig` は登録後の形（`key` / `namespace` を必須で持ち、
 * `requiresReload` を持たない）を表しており、登録時に渡す形とは一致しない。
 * そのため型変換はこのファイルの `register` に1箇所だけ閉じ込めている。
 */
type SettingRegistration = {
  name: string;
  hint?: string;
  scope: "world" | "client" | "user";
  config: boolean;
  type: BooleanConstructor | StringConstructor | NumberConstructor;
  default?: unknown;
  requiresReload?: boolean;
};

type CoreSettingConfig = Parameters<typeof game.settings.register>[2];

const register = (key: keyof EmokloreSettings, config: SettingRegistration): void => {
  game.settings.register(systemID, key, config as unknown as CoreSettingConfig);
};

export function registerSystemSettings(): void {
  register("developerMode", {
    name: "SETTINGS.EMOKLORE.DeveloperMode.Name",
    hint: "SETTINGS.EMOKLORE.DeveloperMode.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    requiresReload: true,
  });

  register("developerActorId", {
    name: "SETTINGS.EMOKLORE.DeveloperActorId.Name",
    hint: "SETTINGS.EMOKLORE.DeveloperActorId.Hint",
    scope: "client",
    config: true,
    type: String,
    default: "",
  });
}

export function getSetting<K extends keyof EmokloreSettings>(key: K): EmokloreSettings[K] {
  return game.settings.get(systemID, key) as EmokloreSettings[K];
}

export function setSetting<K extends keyof EmokloreSettings>(
  key: K,
  value: EmokloreSettings[K],
): Promise<EmokloreSettings[K]> {
  return game.settings.set(systemID, key, value) as Promise<EmokloreSettings[K]>;
}
