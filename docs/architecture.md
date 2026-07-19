# アーキテクチャ

現状の構造と、リファクタリング（ロードマップPhase 2）で目指す姿をまとめる。

## 現状の構造

エントリは `emoklore.ts`。`init` フックでDocumentクラス・DataModel・シート・ダイス関連を `CONFIG` に登録する。

```
emoklore.ts          … エントリ。CONFIG登録、i18nInitでのラベルパッチ、開発用フック
module/
  config/            … 静的なゲームルール定義（技能・特性・共鳴感情など）→ CONFIG.EMOKLORE
  data/              … TypeDataModelスキーマ（character / npc / weapon）と派生値計算
  rules/             … ゲームルールの純粋関数（判定計算・成功数）。Foundry非依存でvitest対象
  documents/         … Actor / Item 拡張。判定の入力を集めて結果を流すオーケストレーション
  applications/      … ApplicationV2シート・ダイアログ（HandlebarsApplicationMixin + Play/Editモードmixin）
  dice/              … カスタムRoll / Die（成功数判定: 1d10≦目標値、1クリティカル / 10ファンブル）
  utils/             … i18n事前ローカライズ、ActiveEffect整理、チャット生成、ココフォリアインポートなど
templates/           … Handlebarsテンプレート
lang/                … ja.json が正、en.json は追従
```

## 既知の構造的課題

1. **スキーマ定義が `CONFIG.EMOKLORE` に依存**: `module/data/character.ts` がキー集合を得るために定義時点で `CONFIG.EMOKLORE` を読む。`TypedObjectField`（v14新フィールド型）で静的スキーマ + 動的キーに置き換えられないか要検討（既存データのマイグレーションが必要）
2. **NPCの扱いが未定**: `EmokloreActor` は `system` を `CharacterDataModel` として扱っており、判定やリソース操作をNPCに対して呼ぶと実行時に壊れる。NPC用シートの実装（Phase 3）で判定まわりごと決める
3. **`config/` の副作用**: `module/config/index.ts` が import 時に `preLocalize` を呼び、`performPreLocalization` が `CONFIG.EMOKLORE` を破壊的に書き換える。この表の「`config/` に置かないもの」に反するが、dnd5e / draw-steel 由来の確立したパターンなので当面は踏襲する

Phase 2 で解消したもの:

- ~~**Documentクラスの責務過多**~~: `rollSkill` / `rollResonance` の判定計算を `module/rules/`、ダイアログを `module/applications/dialogs/`、チャット生成を `module/utils/chat.ts` に分離した
- ~~**プレゼンテーション層にルール計算**~~: `applications/helpers.ts` を責務ごとに `rules/character-points.ts` / `utils/sheet.ts` / `applications/helpers.ts` へ分割した
- ~~**`i18nInit` からのスキーマパッチ**~~: config の複製だったラベルを保存するのをやめ、能力値ラベルは `LOCALIZATION_PREFIXES` と `ja.json` の `FIELDS` に載せた。`game.i18n` への定義時依存もなくなった
- ~~**`as any` の多用**~~: 55箇所あったものをすべて解消し、`biome.json` の `noExplicitAny` を `error` にした。残る `any` は mixin のコンストラクタ制約1箇所のみで、理由コメント付きで個別抑制している
- ~~**開発用ハックの混入**~~: `ready` フックのハードコードされたactor IDを `developerActorId` 設定に置き換えた

## 目指す層分離

dnd5e の module 構成（applications / data / dice / documents / config / utils）を手本に、以下の責務分担へ寄せる。

| 層 | 責務 | 置かないもの |
|---|---|---|
| `config/` | 静的なルール定義のみ（純データ） | ロジック、i18n呼び出し |
| `rules/` | ゲームルールの純粋関数（判定の目標値・成功数・ポイント合計など） | Foundry API、i18n、UI |
| `data/` | スキーマ定義 + 派生値計算（`prepareDerivedData`）+ 判定に渡す値の収集 | UI、チャット生成、計算式の実装 |
| `documents/` | Documentライフサイクルの薄いオーケストレーション。data層とrules層とapplications/chat層をつなぐ | 計算式の実装、ダイアログ |
| `applications/` | シート・ダイアログ。コンテキスト整形のみ | ルール計算 |
| `dice/` | Roll / Die / 結果の表現。判定の計算自体は `rules/` へ委譲する | ルール計算の実装 |
| `utils/` | 汎用ユーティリティ、i18n機構、チャット生成、インポータ | ルール計算 |

### 方針

- **判定ロジックは `rules/` の純粋関数に抽出**し、vitestで単体テスト可能にする。Foundry APIに依存しない形（入力: 技能レベル・修正値など、出力: formula・目標値・成功数）にする
- **ダイアログ（判定オプション入力）はapplicationsに分離**し、Documentメソッドは「入力を集めて判定を実行し結果を流す」だけにする
- **スキーマの動的生成をやめる方向を検討**: `CONFIG.EMOKLORE` に依存したスキーマ生成は、`TypedObjectField`（v14新フィールド型）などで静的なスキーマ + 動的キーに置き換えられないか検討する。ラベルのローカライズは `i18nInit` パッチではなく、Foundry標準の `LOCALIZATION_PREFIXES` / フィールド `label` の仕組みに寄せる
- リファクタリングは機能追加と混ぜず、**挙動を変えないコミット**を小さく積む
