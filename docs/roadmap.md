# ロードマップ

現在はアルファ版（試作品）段階です。しばらくは互換性を気にせず破壊的な変更が続くと思います。

開発は以下の3フェーズで進めます。

## Phase 1: FoundryVTT v14対応

v14専用に移行します（v13サポートは打ち切り）。

具体的なチェックリストは [v14移行チェックリスト](/v14-migration) を参照。調査の結果、必須変更は `system.json` の compatibility 更新のみで、残りはv16で削除予定の非推奨APIの先回り対応です。

**完了**（2026-07-19）。

- [x] `system.json` の compatibility を v14 に
- [x] 非推奨API対応（rollMode→messageMode、ActiveEffect mode→type など）
- [x] TypeScript型定義戦略の決定（fvtt-types継続 or v14本体からの型生成）
- [x] v14で起動して非推奨警告ゼロを確認

## Phase 2: リファクタリング

「動けばいい」で書いてきたコードを、適切な機能を適切な層に分離して責務をはっきりさせる形に書き換えます。設計方針と既知の課題は [アーキテクチャ](/architecture) を参照。

- [x] スキーマ定義の初期化順序依存（`CONFIG.EMOKLORE` / `game.i18n`）の解消
    - `game.i18n` への定義時依存と `i18nInit` からのパッチは解消。キー集合を得るための `CONFIG.EMOKLORE` 参照は残るが、`TypedObjectField` での解消は検討のうえ見送った（理由は [アーキテクチャ](/architecture) の「検討して見送ったもの」）
- [x] `EmokloreActor` から判定計算・ダイアログ・チャット生成を分離
- [x] シート層に混ざったルール計算を data 層へ移動
- [x] `as any` の削減（着手時55箇所 → 0。`noExplicitAny` を lint で `error` に）
- [x] 純粋関数（判定計算など）への vitest テスト導入
- [x] CSS・テンプレートのリファクタリング
    - 656行の単一ファイルを部品（`css/components/`）と配置（`css/applications/`）の2層に分割し、`system.json` で `layer: "system"` を宣言した
    - シート専用だったスタイルを `.emoklore` 直下の部品として切り出し、Phase 3 のアイテムタブ・NPCシートでそのまま使える形にした
    - 重複していたテンプレートを partial にまとめ、`check-templates.mjs` にタグ対応と参照の検査を足した

参考: dnd5e の module 構成（applications / data / dice / documents / config / utils）

## Phase 3: 新機能

- キャラクターシートの機能追加・UI/UX向上
    - 共鳴感情・技能選択にApplicationを用意
    - アイテムタブ追加
    - **一般技能と基本技能の視覚言語を揃える** — 「名前／目標値／能力値アイコン」の並びと書体を両方で揃え、修得技能だけLvとバーを足す。密度の差（行とチップ）は情報量の差に由来するので残す。差を「別物」から「有無」にするのが狙い
    - **ヘッダの再設計** — 名前・HP/MP・共鳴・感情3行の並びに一貫した論理がない。感情をプロフィールタブへ移す案と、名前とリソースを上下2段にする案がある。情報の置き場所を変えるので影響が大きく、案を固めてから着手する
    - **能力値・技能レベルの入力をスライダーから変える** — 公式キャラクターシートのようにバーの中をクリックして値を決めたい

### 調査メモ: 編集時のスライダー

編集モードのスライダーは自前実装ではなく、`NumberField` に `min` / `max` / `integer` が揃っていると本体の `_toInput` が `<range-picker>`（`client/applications/elements/range-picker.mjs`）を返すために出ている。該当は `module/data/character.ts` の `characteristicFieldOptions`（1〜6）と技能の `level`（0〜3）。

置き換えるなら、段の数が高々7と少ないので**ラジオボタンの集合をバー状に見せる**のが素直。`name` を揃えたラジオならフォーム送信も矢印キーの操作もブラウザ任せで済み、`range-picker` より扱いやすい。閲覧モードの `<progress>` と同じ見た目に寄せられるので、モード間の落差も減らせる。

スキーマから `min` / `max` を外すと本体のバリデーションが効かなくなるので、**スキーマは触らず、テンプレート側で `formInput` を使わずに専用partialを描く**のが安全。
- 武器・防具の実装
- NPC, 怪異用のキャラクターシート実装
    - 仕様を要検討
- ハウリングカード実装
- イニシアチブ管理
- FoundryVTT公式に登録

### 正式版に向けて

- ガイアケア対応
    - 差分を調べる
- ActiveEffect誰にでも使いやすいように
    - v14の `CONFIG.ActiveEffect.changeTypes` / `phases`（カスタム効果タイプ登録）の採用を検討
- ある程度の自動化

## 並行プロジェクト

- FoundryVTT開発ドキュメントの日本語整備（別リポジトリ: `fvtt-dev-docs-ja`）

## 実装しないこと

- 高度な自動化
