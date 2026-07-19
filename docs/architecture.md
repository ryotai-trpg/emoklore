# アーキテクチャ

現状の構造と、リファクタリング（ロードマップPhase 2）で目指す姿をまとめる。

## 現状の構造

エントリは `emoklore.ts`。`init` フックでDocumentクラス・DataModel・シート・ダイス関連を `CONFIG` に登録する。

```
emoklore.ts          … エントリ。CONFIG登録、configのラベル事前ローカライズ、開発用フック
module/
  config/            … 静的なゲームルール定義（技能・特性・共鳴感情など）→ CONFIG.EMOKLORE
  data/              … TypeDataModelスキーマ（character / npc / weapon）と派生値計算
  rules/             … ゲームルールの純粋関数（判定計算・成功数）。Foundry非依存でvitest対象
  documents/         … Actor / Item 拡張。判定の入力を集めて結果を流すオーケストレーション
  applications/      … ApplicationV2シート・ダイアログ（HandlebarsApplicationMixin + Play/Editモードmixin）
  dice/              … カスタムRoll / Die（成功数判定: 1d10≦目標値、1クリティカル / 10ファンブル）
  utils/             … i18n事前ローカライズ、ActiveEffect整理、チャット生成、ココフォリアインポートなど
templates/           … Handlebarsテンプレート。partials/ は引数を取る再利用部品
emoklore.css         … @importを並べるだけの目次。規則は書かない
css/
  variables.css      … CSS変数。色はライトを既定にダークだけ上書きする
  components/        … .emoklore の下で成立する部品。位置決めを持たない
  applications/      … module/applications/ と対。部品の配置と寸法
  chat/              … シートの外に出るチャットカード
lang/                … ja.json が正、en.json は追従
```

## 既知の構造的課題

1. **スキーマ定義が `CONFIG.EMOKLORE` に依存**: `module/data/character.ts` がキー集合を得るために定義時点で `CONFIG.EMOKLORE` を読む。`CONFIG.EMOKLORE` を設定するのは自分の `init` フックなので制御下にあるが、他モジュールが `init` 中に `Actor.dataModels.character.schema` へ触ると壊れうる。`TypedObjectField` での解消は検討したうえで見送った（下記）
2. **NPCの扱いが未定**: `EmokloreActor` は `system` を `CharacterDataModel` として扱っており、判定やリソース操作をNPCに対して呼ぶと実行時に壊れる。NPC用シートの実装（Phase 3）で判定まわりごと決める
3. **`config/` の副作用**: `module/config/index.ts` が import 時に `preLocalize` を呼び、`performPreLocalization` が `CONFIG.EMOKLORE` を破壊的に書き換える。この表の「`config/` に置かないもの」に反するが、dnd5e / draw-steel 由来の確立したパターンなので当面は踏襲する

Phase 2 で解消したもの:

- ~~**Documentクラスの責務過多**~~: `rollSkill` / `rollResonance` の判定計算を `module/rules/`、ダイアログを `module/applications/dialogs/`、チャット生成を `module/utils/chat.ts` に分離した
- ~~**プレゼンテーション層にルール計算**~~: `applications/helpers.ts` を責務ごとに `rules/character-points.ts` / `utils/sheet.ts` / `applications/helpers.ts` へ分割した
- ~~**`i18nInit` からのスキーマパッチ**~~: config の複製だったラベルを保存するのをやめ、能力値ラベルは `LOCALIZATION_PREFIXES` と `ja.json` の `FIELDS` に載せた
- ~~**スキーマ定義時の `game.i18n` 依存**~~: 能力値選択肢の `choices` に翻訳済み文字列を入れていたのをi18nキーに変えた。テンプレートが `formInput` に `localize=true` を渡しているため、描画時に本体が解決する
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
| `templates/` | 表示のみ。コンテキストの配列を回して並べる | lookup の組み立て、ルール判断 |
| `css/` | 部品（components）と配置（applications）の2層 | 部品側での位置決め |

## スタイルとテンプレートの規約

### CSS

- ファイルは `emoklore.css` の `@import` で束ねる。**目次には規則を書かない**。並び順がそのままカスケードの順序になる
- `system.json` の `styles` で `layer: "system"` を宣言する。本体は `foundry2.css` の冒頭で `reset, variables, elements, blocks, applications, compatibility, layouts, system, modules, exceptions` を宣言していて、`system` はシステム用に空けてある。`applications` より後なので本体には勝ち、`modules` には負ける
- 自前のクラスはすべて **`em-` 接頭辞 + BEM風**（`.em-meter`, `.em-meter__value`, `.em-progress--hp`）。`.value` や `.label` のような汎用名は他モジュールのCSSと衝突するので作らない
- **部品（`components/`）に位置決めを書かない**。`grid-row` / `grid-column` / 外側の margin / 幅は、置く側（`applications/`）から modifier セレクタで指定する。これがあるのでNPCシートやアイテムシートを足したときに同じ部品をそのまま使える
- Foundry本体のクラス（`.window-content` `.tab` `.sheet-header` `.form-group` `.form-footer` `.flexrow` `.editor-container` `.hint` `.inline-control` `.draggable`）と、`formGroup` が生成する `span.label` はそのまま使う。**`em-` を付けてはいけない**
- `data-*` 属性はJSのフック専用。CSSセレクタに使わない
- `vite.config.ts` は lib mode で `cssFileName` が単一値なので、**CSSは1ファイルにしか出せない**。`styles` を複数エントリにするには `viteStaticCopy` 経由の別系統が要る

### テンプレート

<!-- Handlebarsの {{...}} をVueの補間として解釈させないため v-pre で囲む -->
::: v-pre

- 引数を取る再利用部品は `templates/<種別>/partials/` に置き、先頭のコメントに `@param` を書く
- **入れ子のpartialもPARTSの `templates` に列挙する**。ApplicationV2 は再帰的に解決しないため、漏らすと初回描画は通って再描画で落ちる
- TS側のパスは `systemPath()` を通す。hbs側の `{{> "systems/emoklore/..."}}` はHandlebarsからTSの定数が見えないのでフルパス直書きのまま
- `{{lookup}}` を重ねてconfigを引くのはテンプレートでのデータ整形なので、`applications/` のコンテキスト整形側で解決する
- `{{#each}}` の中から親のコンテキストは**見えない**（Handlebarsは親スコープへフォールバックしない）。`@root` か `../` を明示する
- `npm run check:templates` が構文・HTMLタグの対応・partialの実在・孤児テンプレートを見る。lefthook の pre-commit でも走る

:::

### 開発時の注意

`vite.config.ts` は `emptyOutDir: false` なので、テンプレートを消したり改名したりすると `dist/` に前のファイルが残る。配布物を作る前に `rm -rf dist` する。

### 方針

- **判定ロジックは `rules/` の純粋関数に抽出**し、vitestで単体テスト可能にする。Foundry APIに依存しない形（入力: 技能レベル・修正値など、出力: formula・目標値・成功数）にする
- **ダイアログ（判定オプション入力）はapplicationsに分離**し、Documentメソッドは「入力を集めて判定を実行し結果を流す」だけにする
- ラベルのローカライズは `i18nInit` パッチではなく、Foundry標準の `LOCALIZATION_PREFIXES` / フィールド `label` の仕組みに寄せる（対応済み）
- リファクタリングは機能追加と混ぜず、**挙動を変えないコミット**を小さく積む

## 検討して見送ったもの

### `TypedObjectField` によるスキーマの静的化

`CONFIG.EMOKLORE` への定義時依存を消す手段として検討したが、**見送った**。

本体ソース（`common/data/fields.mjs`）を読んで確認した性質:

- キーを自動生成しない。新規アクターの `skills` は `{}` から始まる
- `element` は全キー共通。技能ごとに `initial` / `choices` / フィールドの有無を変えられない
- 保存形は現在と同一なので、既存データのマイグレーションは不要

見送りの理由は2つ目にある。現在のスキーマは技能ごとのルールを宣言的に持っており、シートがそれを直接読んで描画している。

- `skill.field.fields.characteristic.choices` の有無で、能力値の select と静的表示を出し分けている
- `skill.field.fields.specialization` の有無で、専門分野の入力欄を出し分けている

`TypedObjectField` にするとこれらは表現できず、ルールが config 参照＋実行時コードへ散る。得られるのは定義時依存の解消だけで、その依存が起こす事故はまだ発生しておらず、`CONFIG.EMOKLORE` を設定するのは自分の `init` フックで制御下にある。

より危険だった定義時の `game.i18n` 依存は、`choices` にi18nキーを入れる形に変えて別途解消した。

再検討する価値があるのは、技能を**ユーザーが追加・削除できるようにする**場合。そのときは固定キーのスキーマ自体が成立しなくなるため、前提が変わる。
