# コントリビュートガイド

開発への参加・バグ報告・機能要望を歓迎します。気軽にどうぞ。

- 連絡先: [GitHub Issue](https://github.com/ryotai-trpg/emoklore/issues) または オンセ工房日本支部 Foundry VTT の Discord

## 開発環境

必要なもの:

- Node.js v24以降（`package.json` の `engines` とCIの実行環境がv24。それ未満は検証していない）
- FoundryVTT 本体 v14（動作確認・型チェック用。ライセンスが必要）

```shell
git clone https://github.com/ryotai-trpg/emoklore.git
cd emoklore
npm install
npm run dev   # vite build --watch
```

- FoundryVTT の `Data/systems/emoklore` に `dist/` を配置（またはsymlink）すると、ローカルのFoundryでシステムが読み込まれる
- `vite.config.ts` のproxy設定により、Foundry本体（既定 `localhost:30000`、環境変数 `FOUNDRY_URL` で変更可）を起動した状態で `localhost:30001` を開くと、ビルド結果が反映された画面で開発できる

### 型チェック

型定義はFoundryVTT本体ソース（`client/` / `common/`）を直接参照する（fvtt-typesは不使用。経緯は[v14移行チェックリスト](/v14-migration)）。初回セットアップ:

```shell
cp example-foundry-config.yaml foundry-config.yaml
# foundry-config.yaml の installPath を自分のFoundryインストール先に書き換える
npm run link:foundry   # foundry/client・foundry/common のsymlinkを作成
npm run typecheck      # tsc --noEmit（本体ソース内の診断は除外される）
```

### テスト

**テストの方針は [テスト方針](/testing) が正**。単体テスト（vitest）と実機検証の使い分け、置き場所、実機検証の環境変数はそちらにある。

```shell
npm test              # 単体テスト
npm run verify:live   # 実機検証（ローカルのみ。CIでは回さない）
```

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

- `develop` 宛てに作成する。**タイトル・説明は日本語推奨**（タイトルはコミットメッセージと違いprefix不要。内容が一目で分かる日本語で書く）
- 画面やドキュメントの挙動に関わる変更は、**手元で `npm run verify:live` を通してから出す**。CIでは回らない（[理由](/testing#ciで回さない理由)）
- マージは **merge commit**（squashしない）。PR内のコミットがそのまま履歴に残るため、コミット規約に沿っていることを確認する
- 大きな変更は、着手前にIssueやDiscordで方向性を相談してもらえると安心です

## コーディング方針

- TypeScript は **`strict: true`** に加えていくつかのフラグを有効にしている（一覧は `tsconfig.json`）。**型・命名・層のimport方向の規約は [コード設計の規約](/code-design) が正**。`any` の禁止、`as` の使いどころ、本体の型が足りないときの補い方もそちらにある
- UI文字列は `lang/ja.json` が正で、`en.json` はそれに追従する。スキーマの `label` などは `module/utils/localization.ts` の事前ローカライズ機構を通す
- フォーマット・lintは [Biome](https://biomejs.dev/)（設定: `biome.json`）。手動実行は `npm run check`（修正適用）/ `npm run lint`（検証のみ）。Biomeは型アサーションの組み込みルールを持たないため、二重キャストの禁止はGritQLプラグイン（`tools/no-double-cast.grit`）で実装している
- 設計の方向性・既知の構造的課題は [アーキテクチャ](/architecture) を参照

### 自動チェック

- **pre-commitフック**: `npm install` 時に [lefthook](https://lefthook.dev/) がgitフックを自動セットアップし、コミット時にstagedファイルへBiomeが適用される（修正は自動でstageされる）。`.hbs` を触れば `check:templates`、`lang/*.json` を触れば `check:lang`、`package.json` / `biome.json` / `ci.yml` を触れば `check:biome-version` も走る。緊急時は `git commit --no-verify` でスキップできるが非推奨
- **CI**: pushとPRで GitHub Actions が Biome・テスト・ビルド・型チェック・翻訳/テンプレート/スキーマ表/Biomeバージョンの整合チェックを実行する（`.github/workflows/ci.yml`）。マージにはCIが通ることが必要
  - 型チェックジョブは本体ソース（`client/` + `common/`）をActions cacheで保持し、キャッシュミス時のみ `tools/fetch-foundry.mjs` がsecrets（`FOUNDRY_USERNAME` / `FOUNDRY_PASSWORD`）でfoundryvtt.comからNode配布版を取得する。フォークからのPRでは実行されない
- **依存の更新**: DependabotがnpmとGitHub Actionsを週次で見る（`.github/dependabot.yml`）。パッチとマイナーは1本にまとめ、メジャーは個別にPRが立つ。**Biomeだけは3箇所（`package.json` / `biome.json` の `$schema` / `ci.yml` の `setup-biome`）を揃える必要がある**。Dependabotが上げてくるのは `package.json` だけなので、残り2つは手で追従させる。揃っていなければ `check:biome-version` が落ちるので、追従漏れはDependabotのPRの時点で分かる

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

1. `npm run verify:live` を通す（[実機検証](/testing#実機検証)。CIでは回らないので、ここは人が確認する）
2. `system.json` の `version` を更新する
3. `npm run build` で `dist/` を生成し、`dist.zip` にまとめる
4. GitHub Releaseを作成し、`system.json` と `dist.zip` を添付する（`system.json` の `manifest` / `download` URLはlatest releaseを指している）

## ドキュメントの方針（SSOT）

同じ情報を複数の場所に書かない。内容ごとに「正」となる置き場所（Single Source of Truth）を1つに定め、他の場所からはリンクで参照する。

| 内容 | 正となる場所 |
|---|---|
| セットアップ・開発フロー・各種規約 | `docs/contributing.md`（このページ） |
| 設計方針・アーキテクチャ・既知の構造的課題 | `docs/architecture.md` |
| コード設計の規約（型・命名・層のimport方向） | `docs/code-design.md` |
| テスト方針（単体テスト・実機検証） | `docs/testing.md` |
| UI設計の規約（CSS・テンプレート・ダイアログ） | `docs/ui-design.md` |
| 開発フェーズ計画 | `docs/roadmap.md` |
| v14移行の状況・チェックリスト | `docs/v14-migration.md` |
| ユーザー向けの使い方 | `docs/getting-started.md` ほか機能ページ |
| UI文字列 | `lang/ja.json`（`en.json` は追従） |
| ゲームルール | [公式サイト](https://emoklore.dicetous.com)（実装はルールブックが正） |

`CLAUDE.md` はAIエージェント併用者向けの**参照ハブ**で、上記へのポインタとAI作業に固有の事項だけを載せる。**AIを使わない開発者が読む必要のある情報はCLAUDE.mdに置かない**。このガイドを含むdocs/だけで開発が完結すること。

ローカル環境に固有の情報（FoundryVTT本体ソースの場所など）は、各自がgit管理外の `CLAUDE.local.md`（`.gitignore` 済み）に書く。`CLAUDE.md` がこれをimportするため、AIエージェントにも自動で共有される。マシン依存の手順を収めたAI用プロジェクトスキル（`.claude/skills/`）も同様にgit管理外とする。
