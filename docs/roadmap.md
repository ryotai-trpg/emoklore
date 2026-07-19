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

- [ ] スキーマ定義の初期化順序依存（`CONFIG.EMOKLORE` / `game.i18n`）の解消
- [ ] `EmokloreActor` から判定計算・ダイアログ・チャット生成を分離
- [ ] シート層に混ざったルール計算を data 層へ移動
- [ ] `as any` の削減（着手時55箇所）
- [x] 純粋関数（判定計算など）への vitest テスト導入

参考: dnd5e の module 構成（applications / data / dice / documents / config / utils）

## Phase 3: 新機能

- キャラクターシートの機能追加・UI/UX向上
    - 共鳴感情・技能選択にApplicationを用意
    - アイテムタブ追加
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
