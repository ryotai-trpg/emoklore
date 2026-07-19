# コントリビュートガイド

開発への参加・バグ報告・機能要望を歓迎します。気軽にどうぞ。

- 連絡先: [GitHub Issue](https://github.com/ryotai-trpg/emoklore/issues) または オンセ工房日本支部 Foundry VTT の Discord

## 開発環境

必要なもの:

- Node.js（v22以降推奨）
- FoundryVTT 本体（動作確認用。ライセンスが必要）

```shell
git clone https://github.com/ryotai-trpg/emoklore.git
cd emoklore
ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm install
npm run dev   # vite build --watch
```

- FoundryVTT の `Data/systems/emoklore` に `dist/` を配置（またはsymlink）すると、ローカルのFoundryでシステムが読み込まれる
- `vite.config.ts` のproxy設定により、Foundry本体（`localhost:30000`）を起動した状態で `localhost:30001` を開くと、ビルド結果が反映された画面で開発できる

::: info
開発環境の構成はv14移行作業（[チェックリスト](/v14-migration)）で更新予定。型チェックにFoundry本体ソースを参照する仕組みが入る
:::

## ブランチ運用

- メインブランチは **`develop`**。PRはここへ向ける
- `main` はドキュメントサイトのデプロイ用（pushでGitHub Pagesが更新される）
- 作業ブランチは `feat/weapon-item` のように「種別/短い英語」で命名する

## コミット規約

**1コミット1関心ごと**をなるべく守り、人間が読みやすいコミット履歴にする。

- 1行目: `prefix: 変更の要約` を**英語**で簡潔に
- 2行目: 空行
- 3行目以降: 必要なら**日本語**で背景・理由を書く

prefixは以下の8種:

| prefix | 用途 |
|---|---|
| `feat` | 機能の追加・変更 |
| `fix` | バグ修正 |
| `refactor` | 挙動を変えない内部構造の変更 |
| `style` | フォーマット・CSSなど、動作に影響しない見た目の変更 |
| `test` | テストの追加・修正 |
| `docs` | ドキュメントの変更 |
| `ci` | CI/CDワークフローの変更 |
| `chore` | ビルド設定・依存関係などの雑務 |

例:

```
feat: add resonance roll dialog

共鳴判定の強度・感情一致をダイアログで入力できるようにした。
従来はチャットコマンドでしか指定できなかった。
```

## プルリクエスト

- `develop` 宛てに作成する。説明は日本語でOK
- マージは **merge commit**（squashしない）。PR内のコミットがそのまま履歴に残るため、コミット規約に沿っていることを確認する
- 大きな変更は、着手前にIssueやDiscordで方向性を相談してもらえると安心です

## コーディング方針

- TypeScript（strict化を目指す）。型定義の都合で `as any` が残っているが、**新規コードでは増やさない・触った箇所では減らす**
- UI文字列は `lang/ja.json` が正で、`en.json` はそれに追従する。スキーマの `label` などは `module/helpers/localization.ts` の事前ローカライズ機構を通す
- フォーマット・lintは [Biome](https://biomejs.dev/)（設定: `biome.json`）。手動実行は `npm run check`（修正適用）/ `npm run lint`（検証のみ）
- 設計の方向性・既知の構造的課題は [アーキテクチャ](/architecture) を参照

### 自動チェック

- **pre-commitフック**: `npm install` 時に [lefthook](https://lefthook.dev/) がgitフックを自動セットアップし、コミット時にstagedファイルへBiomeが適用される（修正は自動でstageされる）。緊急時は `git commit --no-verify` でスキップできるが非推奨
- **CI**: pushとPRで GitHub Actions が `biome ci` を実行する（`.github/workflows/ci.yml`）。マージにはCIが通ることが必要

## 表記ルール

- 日本語の文章（ドキュメント・コミット本文・コメント）の句読点は「、」「。」を使う（「，」「．」は使わない）

## 参照資料

- **FoundryVTT APIは本体ソースコードが一次資料**。インストールディレクトリの `client/` / `common/` はJSDocが充実しており、[公式APIドキュメント](https://foundryvtt.com/api/)より正確で詳しい。APIの挙動は推測せずソースを読んで確認する
- 参考システム（実装パターンの手本）:
  - [dnd5e](https://github.com/foundryvtt/dnd5e) — module構成（applications / data / dice / documents / config / utils）の手本
  - [draw-steel](https://github.com/MetaMorphic-Digital/draw-steel) — モダンなApplicationV2ベース実装
  - [ryuutama](https://github.com/krbz999/ryuutama) — 軽量システムの実装例
  - [pf2e](https://github.com/foundryvtt/pf2e) — TypeScript実装の大規模例
- エモクロアTRPGのルール: [公式サイト](https://emoklore.dicetous.com)で無料公開。実装の正はルールブック

## リリース（メンテナ向け）

1. `system.json` の `version` を更新する
2. `npm run build` で `dist/` を生成し、`dist.zip` にまとめる
3. GitHub Releaseを作成し、`system.json` と `dist.zip` を添付する（`system.json` の `manifest` / `download` URLはlatest releaseを指している）

## ドキュメントの方針（SSOT）

同じ情報を複数の場所に書かない。内容ごとに「正」となる置き場所（Single Source of Truth）を1つに定め、他の場所からはリンクで参照する。

| 内容 | 正となる場所 |
|---|---|
| セットアップ・開発フロー・各種規約 | `docs/contributing.md`（このページ） |
| 設計方針・アーキテクチャ・既知の構造的課題 | `docs/architecture.md` |
| 開発フェーズ計画 | `docs/roadmap.md` |
| v14移行の状況・チェックリスト | `docs/v14-migration.md` |
| ユーザー向けの使い方 | `docs/getting-started.md` ほか機能ページ |
| UI文字列 | `lang/ja.json`（`en.json` は追従） |
| ゲームルール | [公式サイト](https://emoklore.dicetous.com)（実装はルールブックが正） |

`CLAUDE.md` はAIエージェント併用者向けの**参照ハブ**で、上記へのポインタとAI作業に固有の事項だけを載せる。**AIを使わない開発者が読む必要のある情報はCLAUDE.mdに置かない**。このガイドを含むdocs/だけで開発が完結すること。

ローカル環境に固有の情報（FoundryVTT本体ソースの場所など）は、各自がgit管理外の `CLAUDE.local.md`（`.gitignore` 済み）に書く。`CLAUDE.md` がこれをimportするため、AIエージェントにも自動で共有される。
