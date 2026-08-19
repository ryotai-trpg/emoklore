import { promises as fs } from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

// vite dev を Foundry へのproxy越しに使うための serve 専用プラグイン。
// Foundryが生成するHTMLは system.json に従って
//   <script type="module" src="systems/emoklore/emoklore.mjs">
//   @import "systems/emoklore/emoklore.css" layer(system)
// を埋め込むが、devサーバにはどちらの実体も無いので、このプラグインが辻褄を合わせる。
//
// 前提: root直下に emoklore.mjs / emoklore.css を置かないこと。実在すると
// vite:resolve が先に解決してしまい、ここでの差し替えが素通りされる。

// vite が渡す id / URL のクエリ（?direct・?import・&t= 等）を落として比較する
const stripQuery = (id: string): string => id.split("?")[0] ?? id;

// Windows でも vite の id は / 区切りなので、比較用パスも / に揃える
const normalize = (p: string): string => p.split(path.sep).join("/");

export function foundryDev(): Plugin {
  let root = "";
  let base = "";
  let entryTs = ""; // <root>/module/emoklore.ts
  let cssIndex = ""; // <root>/css/emoklore.css

  return {
    name: "emoklore:foundry-dev",
    apply: "serve",

    configResolved(config) {
      root = config.root;
      base = config.base;
      entryTs = normalize(path.resolve(root, "module/emoklore.ts"));
      cssIndex = normalize(path.resolve(root, "css/emoklore.css"));
    },

    // HTMLが要求する /systems/emoklore/emoklore.mjs（base除去後 /emoklore.mjs）を
    // TSエントリへマップする。以降のimport解決とTS変換はviteの標準処理が行う
    resolveId(source) {
      if (stripQuery(source) === "/emoklore.mjs") return entryTs;
      return null;
    },

    // devではCSSがJSモジュール経由の <style> 注入になり、system.json の
    // layer: "system" が効かず unlayered として最強になってしまう（モジュールの
    // 上書きがdevでだけ効かない）。本番と同じカスケードにするため @layer system で包む。
    // このtransformは vite:css（postcss-importによる @import インライン化）の後・
    // vite:css-post（JS化）の前に走るので、受け取るcodeは展開済みの1枚のCSS。
    // 制約: css/emoklore.css に外部URLの @import や @charset を書くと
    // インライン化されずに残り、@layer ブロック内では無効になる（現状は相対のみ）
    transform(code, id) {
      if (stripQuery(id) === cssIndex) return { code: `@layer system{${code}}` };
      return null;
    },

    configureServer(server) {
      // HTML内の @import "systems/emoklore/emoklore.css" への応答。実CSSは上の
      // transform経由でJS注入されるので、404ノイズと二重適用を防ぐ空スタブを返す。
      // configureServerで登録したミドルウェアはproxy・base除去より前に走るため、
      // ここはbase付きの生URLで照合する
      const stubUrl = `${base}emoklore.css`;
      server.middlewares.use((req, res, next) => {
        if (req.url && stripQuery(req.url) === stubUrl) {
          res.setHeader("Content-Type", "text/css");
          res.end("/* dev: 実CSSは emoklore.mjs からJS経由で注入される */\n");
          return;
        }
        next();
      });
    },

    // テンプレートはHTTPではなく、Foundryサーバが socket 経由でディスク
    // （Data/systems/emoklore = dist へのsymlink）から読む。viteは経路上に
    // いないので、変更をdistへコピーして届け、フルリロードで反映する。
    // lang はクライアントがHTTP取得し vite-plugin-static-copy のserveミドルウェアが
    // ソースから直接配信するため、コピー不要でリロードだけでよい
    async handleHotUpdate({ file, server }) {
      const templatesDir = `${normalize(path.resolve(root, "templates"))}/`;
      const langDir = `${normalize(path.resolve(root, "lang"))}/`;
      if (file.startsWith(templatesDir) && file.endsWith(".hbs")) {
        const dest = path.resolve(root, "dist", path.relative(root, file));
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.copyFile(file, dest);
        server.ws.send({ type: "full-reload" });
        return [];
      }
      if (file.startsWith(langDir) && file.endsWith(".json")) {
        server.ws.send({ type: "full-reload" });
        return [];
      }
      return undefined;
    },
  };
}
