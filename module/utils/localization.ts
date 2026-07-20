/**
 * CONFIG の事前ローカライズ。dnd5e / draw-steel の仕組みを踏襲している。
 *
 * config には翻訳済みの文字列ではなくi18nキーを置いておき、`i18nInit` の時点で
 * その場の値を翻訳結果に差し替える。こうするとスキーマ定義や config の読み込みが
 * `game.i18n` の準備完了を待たずに済む。
 */

/** どのキーを翻訳対象にするかの登録内容 */
type PreLocalizationRegistration = {
  keys: string[];
};

const registrations: Record<string, PreLocalizationRegistration> = {};

/**
 * `CONFIG.EMOKLORE` 配下のどのパスを翻訳するかを登録する。
 *
 * 値が文字列ならそのまま、オブジェクトなら `keys` で指定したプロパティを翻訳する。
 */
export function preLocalize(
  configKeyPath: string,
  { key, keys = [] }: { key?: string; keys?: string[] } = {},
) {
  if (key) keys.unshift(key);
  registrations[configKeyPath] = { keys };
}

/** 登録済みのパスをまとめて翻訳する。`i18nInit` から1回だけ呼ぶ */
export function performPreLocalization(config: Record<string, unknown>) {
  for (const [keyPath, settings] of Object.entries(registrations)) {
    const target = foundry.utils.getProperty(config, keyPath);
    if (!target) continue;
    localizeObject(target as Record<string, unknown>, settings.keys);
  }
}

function localizeObject(obj: Record<string, unknown>, keys?: string[]): void {
  for (const [k, v] of Object.entries(obj)) {
    const type = typeof v;
    if (type === "string") {
      obj[k] = game.i18n.localize(v as string);
      continue;
    }

    if (type !== "object") {
      console.error(
        new Error(
          `emoklore | 事前ローカライズの対象は文字列かオブジェクトのみ。"${k}" は ${type} でした`,
        ),
      );
      continue;
    }
    if (!keys?.length) {
      console.error(
        new Error(`emoklore | 対象がオブジェクトのときは翻訳するキーの指定が要ります（"${k}"）`),
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
