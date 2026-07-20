# コントリビュートガイド

開発への参加・バグ報告・機能要望を歓迎します。気軽にどうぞ。

- 連絡先: [GitHub Issue](https://github.com/ryotai-trpg/emoklore/issues) または オンセ工房日本支部 Foundry VTT の Discord

## 開発環境

必要なもの:

- Node.js（v22以降推奨）
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

[Vitest](https://vitest.dev/) を使う。テストは対象と同じディレクトリに `*.test.ts` として置く。

```shell
npm test        # 一度だけ実行
npx vitest      # ウォッチモード
```

対象は**FoundryVTT APIに依存しない純粋関数**（判定計算・ポイント計算・書式整形など）に限る。Foundry本体のクラスを継承・参照するコード（`module/dice/` やDocument・シート）はランタイムに本体が必要なため、単体テストではなく実機で確認する。逆に言えば、テストしたいロジックはFoundry非依存の形に切り出す。

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
- マージは **merge commit**（squashしない）。PR内のコミットがそのまま履歴に残るため、コミット規約に沿っていることを確認する
- 大きな変更は、着手前にIssueやDiscordで方向性を相談してもらえると安心です

## コーディング方針

- TypeScript は **`strict: true`**。加えて `noUncheckedIndexedAccess` / `noFallthroughCasesInSwitch` / `noImplicitOverride` / `noImplicitReturns` / `exactOptionalPropertyTypes` を有効にしている。任意プロパティに `undefined` を入れうる場合は `foo?: T | undefined` と書く。`any` は lint で禁止している（`noExplicitAny`）。本体JSDocの型が足りない場合は、`any` で潰さず**実際に使うメンバーだけを交差型で補う**（例: `module/utils/effects.ts`、`module/applications/types.ts` の `SheetDocument`）。どうしても必要なら理由コメント付きで `biome-ignore` する
- UI文字列は `lang/ja.json` が正で、`en.json` はそれに追従する。スキーマの `label` などは `module/utils/localization.ts` の事前ローカライズ機構を通す
- **`as unknown as` の二重キャストは lint で禁止**している（`tools/no-double-cast.grit`）。まず素の `as` で通るか試すこと。アサーションの判定は代入可能性より緩いので、代入で弾かれても `as` 単体なら通ることが多い。本体APIとの境界などで本当に必要なときは、直前の行に `// biome-ignore lint: 理由` を付ける
- フォーマット・lintは [Biome](https://biomejs.dev/)（設定: `biome.json`）。手動実行は `npm run check`（修正適用）/ `npm run lint`（検証のみ）。Biomeは型アサーションの組み込みルールを持たないため、上記の禁止はGritQLプラグインで実装している
- 設計の方向性・既知の構造的課題は [アーキテクチャ](/architecture) を参照

### 自動チェック

- **pre-commitフック**: `npm install` 時に [lefthook](https://lefthook.dev/) がgitフックを自動セットアップし、コミット時にstagedファイルへBiomeが適用される（修正は自動でstageされる）。緊急時は `git commit --no-verify` でスキップできるが非推奨
- **CI**: pushとPRで GitHub Actions が Biome・テスト・ビルド・型チェック・翻訳/テンプレート整合チェックを実行する（`.github/workflows/ci.yml`）。マージにはCIが通ることが必要
  - 型チェックジョブは本体ソース（`client/` + `common/`）をActions cacheで保持し、キャッシュミス時のみ `tools/fetch-foundry.mjs` がsecrets（`FOUNDRY_USERNAME` / `FOUNDRY_PASSWORD`）でfoundryvtt.comからNode配布版を取得する。フォークからのPRでは実行されない

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
| UI設計の規約（CSS・テンプレート・ダイアログ） | `docs/ui-design.md` |
| 開発フェーズ計画 | `docs/roadmap.md` |
| v14移行の状況・チェックリスト | `docs/v14-migration.md` |
| ユーザー向けの使い方 | `docs/getting-started.md` ほか機能ページ |
| UI文字列 | `lang/ja.json`（`en.json` は追従） |
| ゲームルール | [公式サイト](https://emoklore.dicetous.com)（実装はルールブックが正） |

`CLAUDE.md` はAIエージェント併用者向けの**参照ハブ**で、上記へのポインタとAI作業に固有の事項だけを載せる。**AIを使わない開発者が読む必要のある情報はCLAUDE.mdに置かない**。このガイドを含むdocs/だけで開発が完結すること。

ローカル環境に固有の情報（FoundryVTT本体ソースの場所など）は、各自がgit管理外の `CLAUDE.local.md`（`.gitignore` 済み）に書く。`CLAUDE.md` がこれをimportするため、AIエージェントにも自動で共有される。マシン依存の手順を収めたAI用プロジェクトスキル（`.claude/skills/`）も同様にgit管理外とする。
