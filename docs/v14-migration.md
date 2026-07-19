# v14移行チェックリスト

FoundryVTT v14（build 365 stable）の本体ソース（ローカルインストールの `client/` / `common/`）をv13と突き合わせて調査した結果に基づく、本システムの移行チェックリスト。

**結論: 必須変更は `system.json` の compatibility 更新のみ。** 本システムが使うAPI面（ApplicationV2 / HandlebarsApplicationMixin / ActorSheetV2 / TypeDataModel / `Die` / `DiceTerm` / `documentTypes` + `htmlFields` / `grid.*`）はv14で変更なし。v14でのハード削除（`gridDistance`等のマニフェスト旧フィールド、コンペンディウムpack名の自動slug化）はいずれも本システムに該当しない。

また、v14で非推奨化されたAPI（下記）の使用箇所をgrepした結果、**現状のコードに該当なし**。チェックリストの大半は「今後書くコードで新APIを使う」ための備忘録である。

## 作業状況（2026-07-19時点）

- v14移行は `feat/v14` ブランチで**実装完了**。型定義戦略の切り替え・compatibility更新・viteのFOUNDRY_URL対応・CI型チェックジョブ・ドキュメント追従まで実施済み
- v14実機検証（build 365、ポート30014、dev-data-v14）済み: シート描画（Play/Edit両モード）・技能判定・基本技能判定・共鳴判定・イニシアチブロールが正常、コンソールのエラー・非推奨警告ともゼロ
- CI型チェックはsecrets登録済みで**実走成功**（3ジョブすべて緑）
- 残タスク: ココフォリアインポートとActiveEffectの手動確認（自動検証に含まれていない）
- `as any` は約50箇所（リファクタリングPhaseの削減指標として記録）

## 必須

- [x] `system.json`: `compatibility` を `{ "minimum": 14, "verified": 14 }` に（v14専用に移行、v13サポート打ち切り）
  - 補足: v14では compatibility の比較セマンティクスが変わり、整数値（`"14"`）は世代単位、小数点付き（`"14.361"`）は完全一致でマッチする
- [x] v14環境で起動し、コンソールに非推奨警告が出ないことを確認（console.warnフックで検証、警告ゼロ）
- [ ] 主要動作確認: 技能判定・共鳴判定・シートのPlay/Edit切替は確認済み。**ココフォリアインポート・ActiveEffectが未確認**

## 非推奨API（v16で削除予定）— 現状使用なし、今後のコードで注意

### ChatMessage「rollMode」→「messageMode」

- `Roll#toMessage({rollMode})` → `{messageMode}`
- `ChatMessage#applyRollMode` → `applyMode`
- `CONFIG.Dice.rollModes` → `CONFIG.ChatMessage.modes`（キーが `publicroll/gmroll/blindroll/selfroll` → `public/gm/blind/self` に変更、値がラベル付きオブジェクトに）
- `game.settings.get("core", "rollMode")` → `("core", "messageMode")`

### ActiveEffect の大改修

- 数値 `change.mode`（`CONST.ACTIVE_EFFECT_MODES`）→ 文字列 `change.type`（`"add"`, `"multiply"`, …）。既存データは自動マイグレーションされる
- `change.phase` フィールド新設、`change.value` は文字列から `AnyField` に
- ActiveEffect が型付きドキュメント化（`ActiveEffectTypeDataModel`）
- 適用パイプラインのオーバーライド点が改名: `applyField`→`applyChangeField`、`_applyAdd`→`_applyChangeAdd` など

### その他

- 更新の特殊キー `{"-=key": null}` / `{"==key": value}` → 新 `DataFieldOperator` 機構へ
- Handlebarsヘルパー `{{filePicker}}` / `{{rangePicker}}` → `<file-picker>` / `<range-picker>` カスタム要素へ
- `DataField#migrateSource` → `DataField#_migrate`（フィールドでオーバーライドする場合のみ関係）
- `Localization#format` は `localize(stringId, data)` に統合された（正式な非推奨化ではなくランタイムaliasとして残るが、`defineProperties` 定義のため**型には出ない**）。コードは `localize` に移行済み。今後も `format` は使わない

## 挙動変更（要テスト）

- `Roll.replaceFormulaData`: boolean値の展開が `"true"/"false"` → `"1"/"0"` に変更。`getRollData()` は `system` を丸ごとspreadしておりboolean（`isExtra` 等）を含むが、現状formulaで参照しているのは `@initiative` のみなので実害はない見込み。イニシアチブロールを実機確認すること
- `@{path}` 記法と `recursive` オプションが追加された（機会があれば活用）

## ダイス関連の内部変更（本システムへの影響なし・参考）

- `Die` / `DiceTerm` / `RollTerm` はv13と同一。`EmokloreDie` は変更不要
- `RollParser` のコールバック（`_onDiceTerm` 等）に末尾 `offset` 引数が追加された。`EmokloreRollParser` は空サブクラスなので影響なしだが、**今後オーバーライドする場合は新シグネチャに従うこと**

## TypeScript型定義戦略

**推奨: fvtt-typesをやめ、v14本体ソースを `tsconfig.json` の `paths` で直接参照する**（2026-07-19調査、実機検証済み）。

### 調査の経緯

- [fvtt-types](https://github.com/League-of-Foundry-Developers/foundry-vtt-types)（League版）はv13対応がまだベータ、v14対応は未着手（mainブランチ確認済み）。依存ツリーも重い（`npm install` のelectron問題の原因）
- 当初候補だった「本体tsconfigでの `.d.mts` 生成」（`emitDeclarationOnly`）は**非推奨**。anonymousミックスインクラスの制約（TS4094）で43ファイルが未生成になり、`HandlebarsApplicationMixin` と `ClientDocumentMixin` が欠落。生成された `Actor` から `sheet` 等のクライアント側APIが型ごと消え、欠落モジュールが `any` に化けて**型検査が事実上無効になる**ことを実測で確認
- **ソース直接参照方式**なら、TSがミックスインを構造的に推論するためこの問題自体が起きない。「型が効いていればエラーになるべき」プローブ7件を全て正しく検出し、フルチェック約0.7秒。`moduleResolution: "bundler"`（現行設定）でも動作確認済み
- 参考: [draw-steel](https://github.com/MetaMorphic-Digital/draw-steel) が同方式のJS版（リポジトリ内にFoundry本体をsymlinkし `@client/*` パスマッピング）。[pf2e](https://github.com/foundryvtt/pf2e) は3.7MBの型定義を手書き維持しており、個人開発では非現実的

### 移行タスク

- [x] `fvtt-types` を package.json から削除（`npm install` のelectron回避策も不要になった）
- [x] リポジトリ直下にFoundry本体へのsymlink `foundry/` を作成（gitignore済み。`foundry-config.yaml` の `installPath` から `tools/create-symlinks.mjs`（`npm run link:foundry`）が作成する）
- [x] `tsconfig.json`: `types: ["fvtt-types"]` → `["node"]`、`allowJs: true` + `paths`（`@client/*` → `./foundry/client/*`、`@common/*` → `./foundry/common/*`）+ include に `foundry/client/global.d.mts`・`foundry/common/global.d.mts` を追加
- [x] shimファイル `module/types/foundry-shim.d.ts` を作成:
  - レガシーグローバル宣言（`Hooks` / `Actor` / `ActiveEffect` / `Item` / `ChatMessage`）。pf2eの `types/foundry/global-external.d.mts` と同じ手法（`export import Actor = foundry.documents.Actor;` 形式）。コードを `foundry.helpers.Hooks` 等の名前空間アクセスへ移行するならshimは縮小できる
  - `CONFIG.EMOKLORE` は `module/types/emoklore.d.ts` で `declare module "@client/config.mjs"` のモジュール拡張により追加
- [x] `Actor.SubType` などfvtt-types固有の型の使用箇所を自前の型（`"character" | "npc"` 等）に置換

実装時の判明事項:

- 本体JSには `this.constructor.#静的private` などTSのバインダが解釈できない記法が少数（17箇所）あり、checkJs無効・skipLibCheckでも文法カテゴリの診断 **TS1111** だけは抑制できない（TS 5.9・TS 7 nightly双方で確認）。このため `npm run typecheck`（`tools/typecheck.mjs`）が `foundry/` 内の診断を除外して判定する。自コードのエラー検出が生きていることはプローブで確認済み
- スキーマ由来プロパティ（`name` / `flags` / `disabled` / `sort` 等）とmixin越しに消えるメンバー（`isEditable` 等）は、想定どおりサブクラスの `declare` や交差型で補強した（「失われるもの」の表を参照）

### この方式で失われるもの（fvtt-types比）と対処

| 失われるもの | 対処 |
|---|---|
| スキーマ由来プロパティ（`name`・`system` 等）の型（本体JSDocでは実行時定義のため型に出ない） | サブクラスで `declare system: CharacterDataModel;` 等を宣言（既存パターンの継続） |
| 一部ミックスインの継承（`ClientDocumentMixin` はJSDocが `@param {typeof Document}` とジェネリクスを消しており `sheet` 等が見えない） | 使うメンバーだけサブクラスで `declare` 補強（`HandlebarsApplicationMixin` は正しく型が付くのでシート側は問題なし） |
| declaration merging機構（`DocumentClassConfig` / `DataModelConfig` / `SettingConfig` / `HookConfig`）による `actor.system` 自動narrowing・設定/フック名の型付け | サブクラス `declare` と手動型注釈で代替。`game.settings` / `Hooks` は弱い型になるが、emokloreでの使用箇所は少ない |
| スキーマ定義→データ型の自動推論 | 現状も未使用（スキーマを動的生成しているため）。リファクタリングで必要になったら型ヘルパーを自作 |

副次的なメリット: インストール中のFoundryと型が常に一致する（バージョン更新に型の追従を待つ必要がない）。型は `import type { ... } from "@client/..."` で本体のtypedefを直接参照できる。

### CIでの型チェック（Secrets全自動方式）

型チェックに必要なのは本体の `client/` + `common/` 約9MBのみ（Foundry側の `node_modules` 不要を実測確認済み）。以下の構成で手動リフレッシュなしのCIが組める:

- ワークフローで `FOUNDRY_BUILD` をピン留め（ローカルのFoundry更新時に合わせて上げる）
- `actions/cache`（キー: `foundry-types-<build>`）にヒットすればダウンロードなしで型チェック
- キャッシュミス時のみ `tools/fetch-foundry.mjs` が secrets（`FOUNDRY_USERNAME` / `FOUNDRY_PASSWORD`）でfoundryvtt.comにログインし、Node.js buildのzipを取得して `client/` `common/` だけ展開（頻度は月1回程度）
- 認証フロー: `GET foundryvtt.com`（csrfトークン取得）→ `POST /auth/login/` → `GET /releases/download?build=N&platform=node&response_type=json`（presigned URL取得）→ zipダウンロード。felddy/foundryvtt-docker の `src/authenticate.ts` / `get_release_url.ts` と同じ手法
- 注意: フォークPRでは型チェックjobを走らせない（`if:` でガード。公開リポジトリのActions cacheはフォークPRからrestore可能なため）。zipや `client/` `common/` を公開artifactに出さない。アカウントに2FAを設定している場合は自動ログインが通らない可能性があるため要検証

移行タスク（上記に追加）:

- [x] `tools/fetch-foundry.mjs` 作成
- [x] 既存の `.github/workflows/ci.yml`（Biome / build / docs / 翻訳・テンプレートチェックは導入済み）に型チェックジョブを追加（`actions/cache` + fetch-foundry + `npm run typecheck`。将来vitestも追加）
- [x] リポジトリのsecretsに `FOUNDRY_USERNAME` / `FOUNDRY_PASSWORD` を登録し、CI実走を確認（fetch→展開→typecheck→cache保存まで成功。キャッシュキー `foundry-types-365`）

## v14の新機能（採用検討）

- `CONFIG.ActiveEffect.changeTypes` / `phases`: カスタム効果タイプの登録。「ActiveEffectを誰にでも使いやすく」の実装手段として有力
- `TypeDataModel#onEmbed(element)`: 埋め込みHTMLがDOMに入った時のコールバック
- `TypedObjectField` / `AnyField`: 動的キーのシステムデータに使える新フィールド型
- 型付きCombatant（`Combat`/`Combatant` の `baseTypeAllowed`）: イニシアチブ管理実装時に検討
