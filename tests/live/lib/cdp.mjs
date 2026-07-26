// 最小のChrome DevTools Protocolドライバ（依存なし。Node 22+ の標準WebSocketを使う）。
//
// モジュールとしても、CLIとしても使える。
//   node tests/live/lib/cdp.mjs nav <url> | eval <式> | shot <ファイル> | kill
//
// 環境変数:
//   CHROME_BIN … Chromeの実行ファイル。未指定なら既知のパスを順に探す
//   CDP_PORT   … デバッガのポート（既定 9223）。Foundry側のポートとは別
import { spawn } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const CDP_PORT = Number(process.env.CDP_PORT ?? 9223);

// 実行ファイルは環境変数が最優先。無ければmacOS / Linuxの既定の置き場所を順に見る
const CHROME_CANDIDATES = [
  process.env.CHROME_BIN,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

const findChrome = () => {
  const found = CHROME_CANDIDATES.find((path) => existsSync(path));
  if (!found) {
    throw new Error(
      `Chromeが見つからない。CHROME_BIN で実行ファイルを指定する。探した場所:\n  ${CHROME_CANDIDATES.join("\n  ")}`,
    );
  }
  return found;
};

const debuggerUp = async (port) => {
  try {
    await fetch(`http://127.0.0.1:${port}/json/version`);
    return true;
  } catch {
    return false;
  }
};

/** ヘッドレスChromeを起動する。すでに上がっていれば何もしない */
export async function ensureChrome({ port = CDP_PORT, userDataDir } = {}) {
  if (await debuggerUp(port)) return false;

  spawn(
    findChrome(),
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir ?? join(tmpdir(), `emoklore-cdp-${port}`)}`,
      "--window-size=1440,900",
      "--no-first-run",
      "--disable-gpu-sandbox",
      "about:blank",
    ],
    { stdio: "ignore", detached: true },
  ).unref();

  for (let i = 0; i < 50; i++) {
    if (await debuggerUp(port)) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Chromeのデバッガがポート${port}で起動しなかった`);
}

const rpc = async (wsUrl) => {
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = () => rej(new Error(`CDPに接続できない: ${wsUrl}`));
  });

  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (!msg.id || !pending.has(msg.id)) return;
    const { res, rej } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) rej(new Error(msg.error.message));
    else res(msg.result);
  };

  return {
    send: (method, params = {}) =>
      new Promise((res, rej) => {
        ws.send(JSON.stringify({ id: ++id, method, params }));
        pending.set(id, { res, rej });
      }),
    close: () => ws.close(),
  };
};

/**
 * ページを1つ掴んで操作する口を返す。
 *
 * `eval` は関数を渡せる。文字列を組み立てるより読みやすく、引数はJSONで渡る。
 * ページ側で例外が出たら**必ず投げる**（黙って undefined を返さない）。
 */
export async function openPage({ port = CDP_PORT } = {}) {
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = list.find((p) => p.type === "page");
  if (!page) throw new Error("操作できるページが無い");

  const { send, close } = await rpc(page.webSocketDebuggerUrl);

  return {
    async nav(url, { settle = 1500 } = {}) {
      await send("Page.enable");
      await send("Page.navigate", { url });
      await new Promise((r) => setTimeout(r, settle));
    },

    async eval(fnOrExpr, ...args) {
      const expression =
        typeof fnOrExpr === "function"
          ? `(${fnOrExpr})(${args.map((a) => JSON.stringify(a)).join(",")})`
          : fnOrExpr;

      const r = await send("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      if (r.exceptionDetails) {
        const d = r.exceptionDetails;
        throw new Error(d.exception?.description ?? d.text ?? JSON.stringify(d));
      }
      return r.result.value;
    },

    /**
     * 表示領域の大きさを変える。
     *
     * ウィンドウの大きさ（`--window-size`）ではなく**ページの表示領域**を直接指す。
     * 枠のぶんだけ実際の表示領域は小さくなるので、高さが要る撮影ではこちらで決める。
     * `null` を渡すと元に戻る。
     */
    async viewport(size) {
      if (!size) return send("Emulation.clearDeviceMetricsOverride");
      const { width, height, scale = 1 } = size;
      return send("Emulation.setDeviceMetricsOverride", {
        width,
        height,
        deviceScaleFactor: scale,
        mobile: false,
      });
    },

    /**
     * PNGを書き出す。`clip` を渡すとその矩形だけを切り出す。
     *
     * `clip` は CSS ピクセルのビューポート座標（`getBoundingClientRect` がそのまま使える。
     * Foundryの画面は body がスクロールしないので、文書座標と一致する）。`scale` を上げると
     * 出力の解像度が上がり、文字の詰まりを読めるようになる。
     */
    async shot(path, { clip } = {}) {
      const r = await send("Page.captureScreenshot", {
        format: "png",
        ...(clip ? { clip: { scale: 1, ...clip } } : {}),
      });
      const buffer = Buffer.from(r.data, "base64");
      writeFileSync(path, buffer);
      return buffer.byteLength;
    },

    close,
  };
}

/** ブラウザごと終了させる。CDPはpidを教えてくれないのでBrowser.closeを使う */
export async function closeBrowser({ port = CDP_PORT } = {}) {
  if (!(await debuggerUp(port))) return;
  const { webSocketDebuggerUrl } = await (
    await fetch(`http://127.0.0.1:${port}/json/version`)
  ).json();
  const { send, close } = await rpc(webSocketDebuggerUrl);
  try {
    await send("Browser.close");
  } catch {
    // 閉じる過程で接続が切れて応答が返らないことがある。目的は達しているので無視する
  }
  close();
}

// --- CLI ---------------------------------------------------------------
if (import.meta.filename === process.argv[1]) {
  const [cmd, arg] = process.argv.slice(2);

  if (cmd === "kill") {
    await closeBrowser();
    console.log("OK kill");
  } else {
    await ensureChrome();
    const page = await openPage();
    if (cmd === "nav") {
      await page.nav(arg);
      console.log("OK nav", arg);
    } else if (cmd === "eval") {
      console.log(JSON.stringify(await page.eval(arg)));
    } else if (cmd === "shot") {
      await page.shot(arg ?? "shot.png");
      console.log("OK shot", arg);
    } else {
      console.error(
        "使い方: node tests/live/lib/cdp.mjs nav <url> | eval <式> | shot <ファイル> | kill",
      );
      process.exitCode = 1;
    }
    page.close();
  }
}
