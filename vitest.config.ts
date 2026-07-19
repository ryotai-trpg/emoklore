import { defineConfig } from "vitest/config";

// vite.config.ts はライブラリビルドとFoundryへのproxy設定を持つので、テストとは分離する
export default defineConfig({
  test: {
    include: ["module/**/*.test.ts"],
    environment: "node",
  },
});
