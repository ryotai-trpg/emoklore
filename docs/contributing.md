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
npm run dev   # 初回build + HMR付きdevサーバ（localhost:30001）
```

- FoundryVTT の `Data/systems/emoklore` に `dist/` を配置（またはsymlink）すると、ローカルのFoundryでシステムが読み込まれる。devサーバを使うときも必要（Foundryサーバ本体が `system.json` とテンプレートをディスクから読むため）
- Foundry本体（既定 `localhost:30000`、環境変数 `FOUNDRY_URL` で変更可）を起動した状態で `localhost:30001` を開くと、ソースから直接配信された画面で開発できる。CSSは保存で即時反映（HMR、リロード不要）、TS・テンプレート・言語ファイルは保存で自動フルリロードされる
- `localhost:30000` を直接開いた場合は、最後に `npm run build` した内容が表示される（devサーバの変更は乗らない）。バンドルされた実物で確認したいときは `npm run watch`（旧来の `vite build --watch`）を使う

### 型チェック

型定義はFoundryVTT本体ソース（`client/` / `common/`）を直接参照する（fvtt-typesは不使用。理由は[コード設計の規約](/code-design)の「本体の型が足りないとき」にある）。初回セットアップ:

```shell
cp example-foundry-config.yaml foundry-config.yaml
# foundry-config.yaml の installPath を自分のFoundryインストール先に書き換える
npm run link:foundry   # foundry/client・foundry/common のsymlinkを作成
npm run typecheck      # tsc --noEmit（本体ソース内の診断は除外される）
```

### コンペンディウム（packs）

同梱するコンペンディウムの**正は `packs/src/<パック名>/*.json`**で、配る形（LevelDB）はビルドで作る。LevelDBはディレクトリごと1つのデータベースでテキストとしてgitに置けないため、draw-steel と同じくソースをJSONで持つ形にしてある。

```shell
npm run build:packs   # packs/src → dist/packs
```

`npm run build` / `dev` / `watch` はこれを先に走らせるので、普段は個別に叩かなくてよい。

- パック名は `system.json` の `packs[].name` と揃える。揃っていないとFoundryが空のパックを開く
- 各JSONには **`_key` が要る**（`!items!<id>` / `!tables!<id>`、埋め込みは `!items.effects!<親id>.<id>` / `!tables.results!<親id>.<id>`）。**`_key` の無いファイルは黙って飛ばされる**ので、書き忘れると「1件も入らないのにビルドは成功する」
- ドキュメント間の参照は `Compendium.emoklore.<パック名>.<種別>.<id>` の形。`_id` を固定しているのはこのため
- **Foundryを起動したままだとビルドが失敗する。** LevelDBのロックは排他で、パックを開いているプロセスがあると `NotOpenError` になる。Foundryを止めてから叩くこと

### テスト

**テストの方針は [テスト方針](/testing) が正**。単体テスト（vitest）と実機検証の使い分け、置き場所、実機検証の環境変数はそちらにある。

```shell
npm test              # 単体テスト
npm run verify:live   # 実機検証（ローカルのみ。CIでは回さない）
```

- `verify:live` だけは専用の検証環境が要る（`dev` と `typecheck` は普段のFoundryで足りる）。作り方は[テスト方針](/testing#検証環境のセットアップ)にある

## ブランチ運用

- メインブランチは **`develop`**。PRはここへ向ける
- `main` はドキュメントサイトのデプロイ用（pushでGitHub Pagesが更新される）
- 作業ブランチは `feat/weapon-item` のように「種別/短い英語」で命名する

## コミット規約

**1コミット1関心ごと**をなるべく守り、人間が読みやすいコミット履歴にする。リファクタリングは機能追加と混ぜず、挙動を変えないコミットを小さく積む。

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
- UI文字列は `lang/ja.json` が正で、`en.json` はそれに追従する。スキーマの `label` などは `module/utils/localization.ts` の事前ローカライズ機構を通す。**翻訳を引くのは本体のグローバル `_loc`**（`game.i18n.localize` に束縛されたもので、本体自身がこれを使う）。プレースホルダの展開は `_loc(stringId, data)` に統合されており、`format` は使わない（ランタイムaliasとして残るが型に出ない）。本体が解決してくれる場所にはキーをそのまま渡す — 一覧は [UI設計の規約](/ui-design#翻訳は本体に解決させる) にある
- フォーマット・lintは [Biome](https://biomejs.dev/)（設定: `biome.json`）。手動実行は `npm run check`（修正適用）/ `npm run lint`（検証のみ）。Biomeは型アサーションの組み込みルールを持たないため、二重キャストの禁止はGritQLプラグイン（`tools/no-double-cast.grit`）で実装している
- 設計の方向性・既知の構造的課題は [アーキテクチャ](/architecture) を参照

### 自動チェック

- **pre-commitフック**: `npm install` 時に [lefthook](https://lefthook.dev/) がgitフックを自動セットアップし、コミット時にstagedファイルへBiomeが適用される（修正は自動でstageされる）。`.hbs` を触れば `check:templates`、`lang/*.json` を触れば `check:lang`、`system.json` を触れば `check:manifest-urls`、`package.json` / `biome.json` / `ci.yml` を触れば `check:biome-version` も走る。翻訳キーと参照側の突き合わせ（`check:i18n`）は、`lang/*.json` / `.hbs` / `module/**/*.ts` / `system.json` のどれを触っても走る。緊急時は `git commit --no-verify` でスキップできるが非推奨
- **CI**: pushとPRで GitHub Actions が Biome・テスト・ビルド・型チェック・翻訳/テンプレート/スキーマ表/配布URL/Biomeバージョンの整合チェックを実行する（`.github/workflows/ci.yml`）。マージにはCIが通ることが必要
  - 型チェックジョブは本体ソース（`client/` + `common/`）をActions cacheで保持し、キャッシュミス時のみ `tools/fetch-foundry.mjs` がsecrets（`FOUNDRY_USERNAME` / `FOUNDRY_PASSWORD`）でfoundryvtt.comからNode配布版を取得する。フォークからのPRでは実行されない。本体のビルド番号は `ci.yml` の `FOUNDRY_BUILD` でピン留めしてあり（キャッシュキーもここから作られる）、ローカルのFoundryを更新したら合わせて上げる
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

**Releaseとタグを作るのは人**で、`.github/workflows/release.yml` はビルドして `system.json` と `dist.zip` を添付するだけ。draw-steel / ryuutama と同じ形にしてある。

1. `system.json` の `version` と `download` を更新する（`download` は `releases/download/<version>/dist.zip`。揃っていなければ `check:manifest-urls` が落ちるので、直し忘れはコミットの時点で分かる）
2. `npm run verify:live` を通す（[実機検証](/testing#実機検証)。CIでは回らないので、ここは人が確認する）
3. `develop` から `main` へPRを出す。ワークフローがビルドと `dist.zip` の作成まで走らせ、成果物を artifact に残すので、**マージ前に中身を確認できる**。`version` が最新Releaseと同じままなら通知が出る（落としはしない。`main` はドキュメントサイトのデプロイ元でもあり、版を上げないマージも通常のため）
4. マージする
5. GitHubのReleases画面でReleaseを作る。**タグ名は `system.json` の `version` と同じにする**（`main` を対象に「Create new tag on publish」）。ノートを書いてpublishする
6. ワークフローが `system.json` と `dist.zip` を添付する

**publish直後の数十秒はアセットがまだ無い。** `system.json` の `manifest` / `download` が指す `releases/latest/download/` は、添付が終わるまで404を返す。この間に更新確認をした利用者はエラーになるので、混む時間帯を避けるとよい。

タグと `system.json` の `version` が食い違っていたらワークフローが止まる。食い違ったまま配ると更新の検知が壊れるため。ただしその時点でReleaseは公開済みなので、直してタグごと作り直すことになる。**3の通知はこれを事前に拾うためにある。**

型チェックはこのワークフローでは回さない（本体ソースの調達が要るぶん重い）ので、**リリースするコミットはCIが緑であること**を確認する。テストは依存が無く一瞬なのでワークフロー側で通している。

### 配布URLの決まり（`manifest` と `download`）

役割が違うので方式も違う。どちらも間違えても手元では何も起きず、配ったあとに壊れる。`npm run check:manifest-urls` が両方を機械で見ている。

| フィールド | 値 | なぜ |
|---|---|---|
| `manifest` | `releases/latest/download/system.json`（**動くポインタ**） | Foundryが更新確認で引くのは、**インストール済みの** `system.json` に書いてある `manifest`。タグ固定にすると、そのバージョンを入れた人は同じ中身をいつまでも見ることになり、更新が永久に届かない |
| `download` | `releases/download/<version>/dist.zip`（**タグ固定**） | zipのURLは**リモートのマニフェスト**から読まれる。両方 `latest` だと latest を別々に2回解決するので、そのあいだに新しいReleaseが出ると「古いマニフェストで新しいzipを入れる」がありうる |

更新確認の実装は本体の `dist/packages/system.mjs` の `System#getUpdateNotification()` と、`dist/packages/views.mjs` の `installPackage()` にある。前者が `this.manifest` をfetchして `isNewerVersion` で比べ、後者が**リモート側の** `download` を `FileDownloader` に渡す。

参考システムも `manifest` は全て動くポインタで、dnd5e は `raw.githubusercontent.com/.../master/system.json`、draw-steel と ryuutama は `latest`。タグ固定にしているものは1つも無い。

## ドキュメントの方針（SSOT）

同じ情報を複数の場所に書かない。内容ごとに「正」となる置き場所（Single Source of Truth）を1つに定め、他の場所からはリンクで参照する。

| 内容 | 正となる場所 |
|---|---|
| セットアップ・開発フロー・各種規約 | `docs/contributing.md`（このページ） |
| 設計方針・アーキテクチャ・既知の構造的課題・モジュール連携の接続点 | `docs/architecture.md` |
| コード設計の規約（型・命名・層のimport方向） | `docs/code-design.md` |
| テスト方針（単体テスト・実機検証） | `docs/testing.md` |
| UI設計の規約（CSS・テンプレート・ダイアログ） | `docs/ui-design.md` |
| 開発フェーズ計画 | `docs/roadmap.md` |
| ユーザー向けの使い方 | `docs/getting-started.md` ほか機能ページ |
| UI文字列 | `lang/ja.json`（`en.json` は追従） |
| ゲームルール | [公式サイト](https://emoklore.dicetous.com)（実装はルールブックが正） |

`CLAUDE.md` はAIエージェント併用者向けの**参照ハブ**で、上記へのポインタとAI作業に固有の事項だけを載せる。**AIを使わない開発者が読む必要のある情報はCLAUDE.mdに置かない**。このガイドを含むdocs/だけで開発が完結すること。

ローカル環境に固有の情報（FoundryVTT本体ソースの場所など）は、各自がgit管理外の `CLAUDE.local.md`（`.gitignore` 済み）に書く。`CLAUDE.md` がこれをimportするため、AIエージェントにも自動で共有される。マシン依存の手順を収めたAI用プロジェクトスキル（`.claude/skills/`）も同様にgit管理外とする。

### 書き方

ドキュメントは**いまの姿の説明**であって、作業の記録ではない。記録はgitとPRが持つ。

- **現在形で書く**。「解消した」「以前は」「〜済み」の物語を本文に置かない。過去の事故を理由に挙げたいときは「Xすると壊れる」という現在形の条件文に直す。同じ情報で、古くならない
- **設計判断は、いまの形の説明として残す**。採らなかった代替案は「なぜ採らないか」と再検討の条件を現在形で書く。[アーキテクチャ](/architecture)の「検討して見送ったもの」と、[コード設計の規約](/code-design)の厳格フラグの見送り表がその形
- **実測値のスナップショットを本文に写さない**。数えられるものはコード・CI・コマンドが正。「一覧は `tsconfig.json` にある」の形で参照する
- **完了した作業を残さない**。ロードマップの完了は1行のチェックまで。完了済みのチェックリスト・作業ログ・調査メモは、続きがあるならIssueへ移し、ないなら削除する
- **Issue/PR番号は未解決のものだけ書く**。openなIssueへの参照は、閉じるときに一緒に消す。閉じた番号を根拠として書きたくなったら、番号ではなく根拠そのものを本文に書く
- **1ページは1つの関心の正**。複数の関心を抱え始めたら分割を検討する

コード内コメントの規約は[コード設計の規約](/code-design)の「コメント」節が正。
