# CLAUDE.md

エモクロアTRPGの非公式FoundryVTTシステム。ルールは https://emoklore.dicetous.com で無料公開されている（日本語）。

このファイルは**AIエージェント併用者向けの参照ハブ**。プロジェクトの情報は `docs/` が正（SSOT）であり、ここには複製を持たず、ポインタとAI作業に固有の事項だけを書く。AIを使わない開発者は `docs/contributing.md` から読み始めれば十分。

## どこに何があるか（SSOT）

| 知りたいこと | 参照先 |
|---|---|
| セットアップ・コマンド・ブランチ/コミット/PR規約・コーディング方針・参照資料 | `docs/contributing.md` |
| 設計方針・アーキテクチャ・既知の構造的課題 | `docs/architecture.md` |
| 開発フェーズ計画 | `docs/roadmap.md` |
| v14移行の状況・チェックリスト・型定義戦略 | `docs/v14-migration.md` |
| UI文字列 | `lang/ja.json`（正）、`en.json` は追従 |

## よく使うコマンド（詳細と前提: docs/contributing.md）

```shell
ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm install
npm run dev         # vite build --watch（localhost:30001でFoundryにproxy）
npm run docs:dev    # VitePressプレビュー
npm run docs:build  # VitePressビルド
```

## AI作業時の固有事項

- **FoundryVTT APIは推測せず一次資料（本体ソース）を読む**。本体ソースや参考システムのローカルパスは各自の `CLAUDE.local.md`（git管理外、下でimport）に書く
- コミットは `docs/contributing.md` の規約に従い、`Co-Authored-By` などのトレーラーは付けない

@CLAUDE.local.md

## 現在の開発フェーズ

1. **v14対応**（次の作業）— 状況は `docs/v14-migration.md` の「作業状況」
2. リファクタリング — `docs/architecture.md`
3. 新機能 — `docs/roadmap.md`
