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
  esbuild: { keepNames: true },
  build: {
    outDir: "dist",
    emptyOutDir: false,
    sourcemap: true,
    lib: {
      name: "emoklore",
      entry: "emoklore.mjs",
      formats: ["es"],
      fileName: () => "emoklore.mjs",
      cssFileName: "emoklore",
    },
  },
  plugins: [
    viteStaticCopy({
      targets: [
        { src: "system.json", dest: "" },
        {
          src: "lang/*",
          dest: "lang",
        },
        {
          src: "LICENSE",
          dest: "",
        },
        {
          src: "assets/*",
          dest: "assets",
        },
        {
          src: "templates/*",
          dest: "templates",
        },
      ],
    }),
  ],
});
