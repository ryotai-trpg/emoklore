import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  // publicDir: "public",
  base: "/systems/emoklore/",
  // open: "/",
  server: {
    port: 30001,
    proxy: {
      "^(?!/systems/emoklore)": "http://localhost:30000/",
      "/socket.io": {
        target: "ws://localhost:30000",
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
