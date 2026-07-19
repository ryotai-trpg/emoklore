# アーキテクチャ

現状の構造と、リファクタリング（ロードマップPhase 2）で目指す姿をまとめる。

## 現状の構造

エントリは `emoklore.ts`。`init` フックでDocumentクラス・DataModel・シート・ダイス関連を `CONFIG` に登録する。

```
emoklore.ts          … エントリ。CONFIG登録、i18nInitでのラベルパッチ、開発用フック
module/
  config/            … 静的なゲームルール定義（技能・特性・共鳴感情など）→ CONFIG.EMOKLORE
  data/              … TypeDataModelスキーマ（character / npc / weapon）
  documents/         … Actor / Item 拡張。判定ロジック（rollSkill / rollResonance）もここ
  applications/      … ApplicationV2シート（HandlebarsApplicationMixin + Play/Editモードmixin）
  dice/              … カスタムRoll / Die（成功数判定: 1d10≦目標値、1クリティカル / 10ファンブル）
  utils/             … i18n事前ローカライズ、ActiveEffect整理、ココフォリアインポートなど
templates/           … Handlebarsテンプレート
lang/                … ja.json が正、en.json は追従
```

## 既知の構造的課題

1. **初期化順序への密結合**: `module/data/character.ts` のスキーマ定義が、定義時点で `CONFIG.EMOKLORE` と `game.i18n` に依存している。さらに `emoklore.ts` の `i18nInit` フックが外側からスキーマのラベルをパッチしており、データ層の関心事がエントリに漏れている
2. **Documentクラスの責務過多**: `module/documents/actor.ts` の `rollSkill` / `rollResonance` が判定計算・ダイアログUI・チャットメッセージ生成を1メソッドに混在させている（コード中にも `// TODO: Refactor`）
3. **プレゼンテーション層にルール計算**: `module/applications/helpers.ts` に `calculateCharPointSum` / `calculateTotalSkillPoints` などのルール計算がある
4. **`as any` の多用**: 型戦略が未確立（→ [v14移行チェックリスト](/v14-migration) の型定義戦略を参照）
5. **開発用ハックの混入**: `emoklore.ts` の `ready` フックにハードコードされたactor ID

## 目指す層分離

dnd5e の module 構成（applications / data / dice / documents / config / utils）を手本に、以下の責務分担へ寄せる。

| 層 | 責務 | 置かないもの |
|---|---|---|
| `config/` | 静的なルール定義のみ（純データ） | ロジック、i18n呼び出し |
| `data/` | スキーマ定義 + 派生値計算（`prepareDerivedData`）+ ルール計算（判定の目標値・成功数・ポイント合計など） | UI、チャット生成 |
| `documents/` | Documentライフサイクルの薄いオーケストレーション。data層のルール計算とapplications/chat層をつなぐ | 計算式の実装、ダイアログ |
| `applications/` | シート・ダイアログ。コンテキスト整形のみ | ルール計算 |
| `dice/` | Roll / Die / 結果の表現 | — |
| `utils/` | 汎用ユーティリティ、i18n機構、インポータ | ルール計算 |

### 方針

- **判定ロジックはdata層（またはrulesモジュール）の純粋関数に抽出**し、vitestで単体テスト可能にする。Foundry APIに依存しない形（入力: 技能レベル・修正値など、出力: formula・目標値・成功数）を目指す
- **ダイアログ（判定オプション入力）はapplicationsに分離**し、Documentメソッドは「入力を集めて判定を実行し結果を流す」だけにする
- **スキーマの動的生成をやめる方向を検討**: `CONFIG.EMOKLORE` に依存したスキーマ生成は、`TypedObjectField`（v14新フィールド型）などで静的なスキーマ + 動的キーに置き換えられないか検討する。ラベルのローカライズは `i18nInit` パッチではなく、Foundry標準の `LOCALIZATION_PREFIXES` / フィールド `label` の仕組みに寄せる
- リファクタリングは機能追加と混ぜず、**挙動を変えないコミット**を小さく積む
