import { SYSTEM_ID } from "./constants";

/**
 * 判定ダイアログをいつ開くか。
 *
 * `modifier` は素のクリックで即ロール、修飾キー付きで開く（既定）。
 */
export type SkillRollDialogMode = "modifier" | "always";

/** ダメージ適用の結果を誰に見せるか。`mode` は本体のチャットのモード選択に従う */
export type DamageResultVisibility = "public" | "gm" | "mode";

interface EmokloreSettings {
  developerMode: boolean;
  developerActorId: string;
  /** キャラクターシートのサイドバーを畳んでいるか。表示状態なのでユーザーごとに持つ */
  sidebarCollapsed: boolean;

  // 自動化の程度。**既定はすべて現状の挙動**で、切ったときだけ自動処理が止まる。
  // 「高度な自動化」は実装しない方針（docs/roadmap.md）なので、ここに増えるのは
  // 既にあるものを止めるつまみだけになる
  autoArmorReduction: boolean;
  autoHpBoundaryNotice: boolean;
  autoMpBoundaryNotice: boolean;
  autoSurvivalReminder: boolean;
  autoResonanceRise: boolean;
  autoEmotionMatch: boolean;
  skillRollDialog: SkillRollDialogMode;
  damageResultVisibility: DamageResultVisibility;
}

/**
 * `game.settings.register` の第3引数として実際に渡すもの。
 *
 * 本体JSDocの `SettingConfig` は登録後の形（`key` / `namespace` を必須で持ち、
 * `requiresReload` を持たない）を表しており、登録時に渡す形とは一致しない。
 * そのため型変換はこのファイルの `register` に1箇所だけ閉じ込めている。
 */
type SettingRegistration = {
  /** 設定画面に出す名前。`config: false` の内部状態には要らない */
  name?: string;
  hint?: string;
  scope: "world" | "client" | "user";
  config: boolean;
  type: BooleanConstructor | StringConstructor | NumberConstructor;
  /** 値と表示名（i18nキー）の対。渡すと設定画面が select になる */
  choices?: Record<string, string>;
  default?: unknown;
  requiresReload?: boolean;
};

type CoreSettingConfig = Parameters<typeof game.settings.register>[2];

const register = (key: keyof EmokloreSettings, config: SettingRegistration): void => {
  // biome-ignore lint: 本体の SettingConfig は登録後の形なので、登録時の形とは重ならない
  game.settings.register(SYSTEM_ID, key, config as unknown as CoreSettingConfig);
};

/**
 * 自動化のトグルを1つ登録する。
 *
 * 卓ごとの取り決めなので world スコープ。既定はすべて true（現状の挙動）で、
 * 名前とヒントは `SETTINGS.EMOKLORE.<キー>` から引く。
 */
const registerAutomation = (key: keyof EmokloreSettings): void => {
  register(key, {
    name: `SETTINGS.EMOKLORE.${key}.Name`,
    hint: `SETTINGS.EMOKLORE.${key}.Hint`,
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });
};

export function registerSystemSettings(): void {
  register("developerMode", {
    name: "SETTINGS.EMOKLORE.DeveloperMode.Name",
    hint: "SETTINGS.EMOKLORE.DeveloperMode.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
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

  // シートの表示状態なので設定画面には出さない。ユーザーごとに閉じるので client スコープ。
  // アクターのフラグにするとGMが畳んだ状態がプレイヤーにも伝わってしまう
  register("sidebarCollapsed", {
    scope: "client",
    config: false,
    type: Boolean,
    default: false,
  });

  registerAutomation("autoArmorReduction");
  registerAutomation("autoHpBoundaryNotice");
  registerAutomation("autoMpBoundaryNotice");
  registerAutomation("autoSurvivalReminder");
  registerAutomation("autoResonanceRise");
  registerAutomation("autoEmotionMatch");

  // 判定ダイアログを開く条件だけは手元の好みなので client スコープ。
  // 卓の取り決めではなく「毎回聞かれたいか」の話になる
  register("skillRollDialog", {
    name: "SETTINGS.EMOKLORE.skillRollDialog.Name",
    hint: "SETTINGS.EMOKLORE.skillRollDialog.Hint",
    scope: "client",
    config: true,
    type: String,
    choices: {
      modifier: "SETTINGS.EMOKLORE.skillRollDialog.Modifier",
      always: "SETTINGS.EMOKLORE.skillRollDialog.Always",
    },
    default: "modifier" satisfies SkillRollDialogMode,
  });

  register("damageResultVisibility", {
    name: "SETTINGS.EMOKLORE.damageResultVisibility.Name",
    hint: "SETTINGS.EMOKLORE.damageResultVisibility.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      public: "SETTINGS.EMOKLORE.damageResultVisibility.Public",
      gm: "SETTINGS.EMOKLORE.damageResultVisibility.Gm",
      mode: "SETTINGS.EMOKLORE.damageResultVisibility.Mode",
    },
    default: "public" satisfies DamageResultVisibility,
  });
}

export function getSetting<K extends keyof EmokloreSettings>(key: K): EmokloreSettings[K] {
  return game.settings.get(SYSTEM_ID, key) as EmokloreSettings[K];
}

export async function setSetting<K extends keyof EmokloreSettings>(
  key: K,
  value: EmokloreSettings[K],
): Promise<void> {
  await game.settings.set(SYSTEM_ID, key, value);
}
