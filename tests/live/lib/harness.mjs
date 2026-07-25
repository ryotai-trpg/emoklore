// 検証の足場。チェックの実行と集計、ページ側に仕込む道具。

/** 結果を集めながらチェックを走らせる。1件落ちても続けて、最後にまとめて報告する */
export function createRunner({ log }) {
  const results = [];

  const check = async (name, fn) => {
    try {
      const detail = await fn();
      results.push({ name, ok: true, detail });
      log(`  ok   ${name}${detail ? ` … ${detail}` : ""}`);
    } catch (error) {
      results.push({ name, ok: false, error: error.message });
      log(`  NG   ${name}\n       ${error.message.split("\n").join("\n       ")}`);
    }
  };

  return { check, results };
}

/**
 * ページ側の検証関数は `{ ok, detail }` を返す。ok が false なら detail を理由として投げる。
 *
 * 形が違うものを返したら、それも失敗として扱う。`undefined` を素通りさせると
 * 「検証関数を書き間違えた」が「合格」に化けるため。
 */
export const assertInPage = async (page, fn, ...args) => {
  const r = await page.eval(fn, ...args);
  if (!r || typeof r !== "object") {
    throw new Error(`検証関数が {ok, detail} を返さなかった: ${JSON.stringify(r)}`);
  }
  if (!r.ok) throw new Error(r.detail ?? "詳細なし");
  return r.detail;
};

/**
 * ページ側に検証用の道具を仕込む。
 *
 * `__errs` はエラーの記録。console.error も横取りしないと、本体が握り潰した例外
 * （フックの中など）が見えない。
 *
 * `__waitFor` は「条件が満たされるまで待つ」。固定の setTimeout で待つと、待ち時間の
 * 総和がそのまま実行時間になるうえ、遅い環境では足りずに落ちる。条件で待てば
 * 速い環境では即座に進み、遅い環境でも取りこぼさない。
 * `soft: true` なら時間切れで例外にせず undefined を返す。呼び出し側が
 * 「起きなかったこと」を自分の言葉で報告したいときに使う。
 *
 * `__cardAction` はチャットカードのボタンを、DOMを介さずに押す。ハンドラの実体は
 * バンドルの中なので、カードが公開している `ACTIONS`（モジュール向けの拡張点）から引く。
 */
export const installPageHelpers = (page) =>
  page.eval(() => {
    window.__errs = [];
    window.addEventListener("error", (e) =>
      window.__errs.push(String(e.error?.message ?? e.message)),
    );
    window.addEventListener("unhandledrejection", (e) => window.__errs.push(String(e.reason)));
    const original = console.error;
    console.error = (...args) => {
      window.__errs.push(args.map(String).join(" "));
      original(...args);
    };

    // 本体の通知は console にも流れる（notifications.mjs の notify は console=true が既定で、
    // 描画時に console[fn](el.textContent) を呼ぶ）。つまり `ui.notifications.error()` で
    // 正しくユーザーに知らせているだけの場面が、そのままコンソールエラーとして数えられる。
    // 通知を別に記録しておき、エラーの側からは「通知で説明できるもの」を差し引く。
    window.__notes = [];
    const notify = ui.notifications.notify.bind(ui.notifications);
    ui.notifications.notify = (message, type = "info", options = {}) => {
      const text = options?.localize ? game.i18n.localize(message) : String(message);
      window.__notes.push({ type, message: text, expected: false });
      return notify(message, type, options);
    };

    /** 通知で説明のつかないエラーだけを返す。これが空でないなら本当に何かが壊れている */
    window.__unexpectedErrors = () =>
      window.__errs.filter(
        (e) => !window.__notes.some((n) => n.message && e.includes(n.message.trim())),
      );

    /** 意図して出させた通知に印を付ける。総合チェックはこれを見逃す */
    window.__expectNotesSince = (from) => {
      const produced = window.__notes.slice(from);
      for (const n of produced) n.expected = true;
      return produced;
    };

    /**
     * チャットカードのボタンを、DOMを介さずに押す。
     *
     * ハンドラの実体はバンドルの中なので直接は呼べない。カードのデータモデルが公開して
     * いる `ACTIONS`（`data-action` の値からハンドラを引く表。モジュール向けの拡張点で、
     * 実際のクリックもここを通る）から引いて、モデルに束ねて呼ぶ。
     *
     * 無いアクションを黙って素通りさせない。綴りを間違えたまま「押したつもり」で
     * 先に進むと、何も起きていないのに通ってしまう。
     */
    window.__cardAction = (message, action) => {
      const handler = message.system?.constructor?.ACTIONS?.[action];
      if (!handler) throw new Error(`カードのアクションが無い: ${action}`);
      return handler.call(message.system);
    };

    /**
     * 閲覧/編集の切替ボタン。
     *
     * mixin が `_renderFrame` でウィンドウ枠に足すので、シート本体（`sheet.element`）の
     * 外にある。見つからないまま `?.click()` で流すと「切り替えたつもりで閲覧のまま
     * 検証していた」ことに気付けないので、無ければ投げる。
     */
    window.__modeToggle = (sheet) => {
      const frame = sheet.element.closest(".application") ?? sheet.element.parentElement;
      const button = frame?.querySelector("[data-action=toggleMode]");
      if (!button) throw new Error("モード切替ボタンが見つからない");
      return button;
    };

    /**
     * モードを切り替えて、描き直されるまで待つ。
     *
     * `_mode` はクリック直後に変わるが、`render()` は待たれない。フラグだけを見ると
     * 「切り替えたつもりで、まだ前のDOMを数えている」ことになるので、中身が
     * 入れ替わるまで待つ。
     */
    window.__setMode = async (sheet, mode) => {
      const wanted = mode === "edit";
      if (sheet.isEditMode === wanted) return;
      const before = sheet.element.innerHTML;
      window.__modeToggle(sheet).click();
      await window.__waitFor(
        () => sheet.isEditMode === wanted && sheet.element.innerHTML !== before,
        { label: `${mode}モードへの切り替え` },
      );
    };

    /**
     * 画面に出てしまっている未解決の翻訳キーを拾う。
     *
     * `game.i18n.localize` は引けなかったキーをそのまま返すので、`lang/ja.json` に
     * 無いキーは画面に "EMOKLORE.Foo.bar" と出る。`check:lang` は ja/en の突き合わせ
     * しかしないため、片方から消えた・綴りを間違えた場合はここでしか気付けない。
     *
     * テキストだけでなく placeholder なども見る（キーが属性側に出ることがある）。
     * `data-tooltip` は本体が表示のたびに解決するので、生キーが入っていて正しい。
     */
    window.__findUnresolvedKeys = (root) => {
      const found = new Set();
      const scan = (text) => {
        for (const m of String(text ?? "").matchAll(/EMOKLORE\.[A-Za-z0-9._]+/g)) found.add(m[0]);
      };
      for (const node of root.querySelectorAll("*")) {
        for (const child of node.childNodes) {
          if (child.nodeType === Node.TEXT_NODE) scan(child.textContent);
        }
        for (const attr of ["placeholder", "title", "aria-label", "label", "alt"]) {
          if (node.hasAttribute(attr)) scan(node.getAttribute(attr));
        }
      }
      return [...found];
    };

    window.__waitFor = async (
      fn,
      { timeout = 8000, interval = 25, label = "", soft = false } = {},
    ) => {
      const started = Date.now();
      for (;;) {
        const value = await fn();
        if (value) return value;
        if (Date.now() - started > timeout) {
          if (soft) return undefined;
          throw new Error(`待機が時間切れ（${timeout}ms）: ${label}`);
        }
        await new Promise((r) => setTimeout(r, interval));
      }
    };
    return true;
  });

/**
 * ダイスを固定する。
 *
 * 本体は `CONFIG.Dice.randomUniform` を差し替え可能にしており、出目は
 * `mapRandomFace(u) = ceil((1 - u) * 面数)` で決まる（`client/dice/terms/dice.mjs`）。
 * 固定しないと「攻撃が外れたのでダメージが振れない」を不具合と区別できず、
 * 実行ごとに結果が変わる検証になってしまう。
 */
export const pinDice = (page, u) =>
  page.eval((value) => {
    CONFIG.Dice.randomUniform = () => value;
    return true;
  }, u);

export const DICE = {
  /** 出目1。エモクロアではクリティカルなので必ず成功する */
  alwaysHit: 0.999,
  /** 出目が面数そのもの。d10ならファンブルで必ず失敗する */
  alwaysMiss: 0,
};
