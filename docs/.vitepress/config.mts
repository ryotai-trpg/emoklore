import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "エモクロアTRPG for FoundryVTT",
  description: "System Implementation (Unofficial)",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
    ],

    sidebar: [
      {
        text: 'イントロダクション',
        items: [
          { text: 'はじめる', link: '/getting-started' },
          { text: '開発メモ', link: '/dev-note' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/ryotai-trpg/emoklore' }
    ]
  }
})
