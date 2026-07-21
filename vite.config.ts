import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

// proxy先のFoundry本体。既定はメイン環境（30000）、検証環境に向ける場合は
// FOUNDRY_URL=http://localhost:30014 のように上書きする
const foundryUrl = process.env.FOUNDRY_URL ?? "http://localhost:30000";

export default defineConfig({
  // publicDir: "public",
  base: "/systems/emoklore/",
  // open: "/",
  server: {
    port: 30001,
    proxy: {
      "^(?!/systems/emoklore)": foundryUrl,
      "/socket.io": {
        target: foundryUrl.replace(/^http/, "ws"),
        ws: true,
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: false,
    sourcemap: true,
    // Vite 8 のバンドラは rolldown で、変換は esbuild ではなく oxc が行う。
    // 旧 `esbuild: { keepNames: true }` は黙って無視され、クラス名が1文字に潰れる。
    // 本体はシート登録やデータモデルの識別にクラス名を使うので、出力側で保つ
    rollupOptions: {
      output: { keepNames: true },
    },
    lib: {
      name: "emoklore",
      entry: "module/emoklore.ts",
      formats: ["es"],
      fileName: () => "emoklore.mjs",
      cssFileName: "emoklore",
    },
  },
  plugins: [
    viteStaticCopy({
      // v4 はコピー元の相対パスを保つので、dest はすべて dist 直下（""）でよい。
      // v3 の `lang/*` + `dest: "lang"` は v4 では dist/lang/lang/ に二重に入る。
      // また v4 の `*` はディレクトリに一致しないため、ディレクトリごと指定する
      targets: [
        { src: "system.json", dest: "" },
        { src: "LICENSE", dest: "" },
        { src: "lang", dest: "" },
        { src: "assets", dest: "" },
        { src: "templates", dest: "" },
      ],
    }),
  ],
});
