import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  base: "/emoklore/",
  title: "エモクロアTRPG for FoundryVTT",
  description: "System Implementation (Unofficial)",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [{ text: "Home", link: "/getting-started" }],

    sidebar: [
      {
        // text: 'イントロダクション',
        items: [{ text: "はじめる", link: "/getting-started" }],
      },
      {
        text: "機能",
        items: [
          { text: "キャラクターシート", link: "/character-sheet" },
          { text: "キャラクターのインポート", link: "/character-import" },
          { text: "効果（ActiveEffect）", link: "/active-effect" },
        ],
      },
      {
        text: "開発",
        items: [
          { text: "コントリビュートガイド", link: "/contributing" },
          { text: "ロードマップ", link: "/roadmap" },
          { text: "アーキテクチャ", link: "/architecture" },
          { text: "コード設計の規約", link: "/code-design" },
          { text: "データモデル", link: "/data-model" },
          { text: "テスト方針", link: "/testing" },
          { text: "UI設計の規約", link: "/ui-design" },
          { text: "v14移行チェックリスト", link: "/v14-migration" },
          { text: "メモ", link: "/dev-note" },
        ],
      },
    ],

    socialLinks: [{ icon: "github", link: "https://github.com/ryotai-trpg/emoklore" }],
  },
});
