# UI設計の規約

CSS・テンプレート・ダイアログの規約と、その背後にある設計原則をまとめる。ここがUIに関する規約の正（SSOT）。

貫いている考えは1つ、**寸法を誰が決めるのかをはっきりさせる**こと。固定pxの数値をあちこちに散らすと、中身の量が変わった瞬間に崩れる。崩れた箇所をpxで微調整すると、次はその調整が別の箇所を壊す。この連鎖を断つための規約が以下になる。

## 層の責務

`emoklore.css` は `@import` の目次で、並び順がそのままカスケードの順序になる。**目次には規則を書かない**。

| 層 | 持つもの | 持ってはいけないもの |
|---|---|---|
| `css/variables.css` | 値（カスタムプロパティ）だけ | セレクタごとの規則 |
| `css/components/` | 部品の**内部**の構造 | 自分の外側の寸法・位置 |
| `css/applications/` | 部品の**配置と外形寸法** | 部品の内部構造 |
| `css/chat/` | シートの外に出るチャットカード | `.emoklore` スコープへの依存 |

**部品に位置決めを書かない**。`grid-row` / `grid-column` / 外側の margin / 幅は、置く側（`applications/`）から modifier セレクタで指定する。これがあるのでNPCシートやアイテムシートを足したときに同じ部品をそのまま使える。

`system.json` の `styles` で `layer: "system"` を宣言する。本体は `foundry2.css` の冒頭で `reset, variables, elements, blocks, applications, compatibility, layouts, system, modules, exceptions` を宣言していて、`system` はシステム用に空けてある。`applications` より後なので本体には勝ち、`modules` には負ける。本体側は `@import "..." layer(system)` の形で読み込む（`templates/views/layouts/main.hbs`）ため、`emoklore.css` の中で `@layer` を書けば `system` の副レイヤになる。

## 寸法の決め方

- **固定pxは「中身が変わらないもの」にだけ許す**。アイコンの枠、バーの高さ、ボーダー幅などがこれにあたる。**文字が入る箱には使わない**
- グリッドアイテムは既定で `min-width: auto` なので、内容が最小幅を押し上げる。**縮めたい列には明示的に `minmax(0, ...)` か `min-width: 0`** を書く。これを忘れると、長い名前や長いラベルが親の枠を破る
- **兄弟の間で数値を手計算で一致させない**。片方を変えるともう片方が黙って壊れ、依存関係がコードのどこにも現れない。共有する寸法は変数に出すか、後述のとおり同じグリッドに載せて解決する

::: warning かつて実際にあった例
`.em-resources` の右列 `145px` と、共鳴メータ内部の `49px + 56px + 40px = 145px` が手計算で一致させられていた。どちらにもその依存関係を示すコメントはなかった。現在は同じグリッドに載せることで解消している。
:::

## 整列は「同じグリッドに載せる」で解く

要素同士を横一線に揃えたいとき、**それぞれの箱の中で位置を調整してはいけない**。箱の高さは中身に応じて独立に決まるので、揃うのは偶然にすぎず、中身が変われば崩れる。

- 揃えたい要素同士は、**同じグリッドコンテナのトラックを共有させる**
- 入れ子の要素を親のトラックに載せるときは `grid-template-rows: subgrid` / `grid-template-columns: subgrid` を使う
- **`margin-top: 5px` のようなpxの微調整で揃えない**。それは揃っていることの証明にならない

HP・MP・共鳴の3本のバーは、`.em-resources` が持つ行トラックを `subgrid` で共有している。共鳴は見出しが3行ぶんの高さを取るが、バーは他と同じ行トラックに落ちるので必ず揃う。

## はみ出しの扱い

可変長のテキストを置く箱は、**切り詰め（ellipsis）か折り返しかを必ず明示する**。どちらも書かないのは「はみ出してよい」と宣言しているのと同じ。

文字サイズを容器に追従させたいときは `clamp()` とコンテナクエリ単位（`cqi`）を使う。キャラクター名は `container-type: inline-size` を敷いたヘッダの中で `clamp()` により伸縮し、それでも収まらない場合に切り詰める、という二段構えにしている。

## トークン

- **間隔は本体の `--spacer-2` / `-4` / `-8` / `-12` / `-16` を使う**。独自のgap値を書かない
- 色・フォントサイズも本体の変数を優先し、本体にないものだけ `--emoklore-*` として `css/variables.css` に定義する
- **本体変数はテーマに追従するものを選ぶ**。`foundry2.css` の `@layer variables.base` にある `body.game .app` ブロックの `--color-text-dark-secondary` や `--color-border-dark-tertiary` などはv11系のレガシーで値が固定されており、テーマを切り替えても変わらない。テーマ対応版は `@layer variables.themes` にある
- `--emoklore-*` の色はライトテーマの値を既定に置く。本体は `prefers-color-scheme` がライトでもダークでもない環境では `body` にテーマクラスを付けない（`client/game.mjs` の `#configureTheme`）ため、テーマ別ブロックだけに色を置くと変数が未定義になる

## マークアップ

- 自前のクラスはすべて **`em-` 接頭辞 + BEM風**（`.em-meter`, `.em-meter__value`, `.em-progress--hp`）。`.value` や `.label` のような汎用名は他モジュールのCSSと衝突するので作らない
- Foundry本体のクラス（`.window-content` `.tab` `.sheet-header` `.form-group` `.form-footer` `.flexrow` `.editor-container` `.hint` `.inline-control` `.draggable`）と、`formGroup` が生成する `span.label` はそのまま使う。**`em-` を付けてはいけない**
- `data-*` 属性はJSのフック専用。CSSセレクタに使わない
- **意味を持つ要素を使う**。対になった項目の並びは `dl` / `dt` / `dd`、リストは `ul` / `ol`、フォームの塊は `fieldset` / `legend`。`div` を並べてCSSで見た目だけ整えない
- **レイアウトのためだけのラッパを増やさない**。グリッドの入れ子が要るように見えたら、まず `grid-template-areas` や `subgrid` で親のトラックに直接載せられないか検討する。`display: contents` も選択肢になる
- `vite.config.ts` は lib mode で `cssFileName` が単一値なので、**CSSは1ファイルにしか出せない**。`styles` を複数エントリにするには `viteStaticCopy` 経由の別系統が要る

## テンプレート

<!-- Handlebarsの {{...}} をVueの補間として解釈させないため v-pre で囲む -->
::: v-pre

- 引数を取る再利用部品は `templates/<種別>/partials/` に置き、先頭のコメントに `@param` を書く
- **入れ子のpartialもPARTSの `templates` に列挙する**。ApplicationV2 は再帰的に解決しないため、漏らすと初回描画は通って再描画で落ちる
- TS側のパスは `systemPath()` を通す。hbs側の `{{> "systems/emoklore/..."}}` はHandlebarsからTSの定数が見えないのでフルパス直書きのまま
- `{{lookup}}` を重ねてconfigを引くのはテンプレートでのデータ整形なので、`applications/` のコンテキスト整形側で解決する
- `{{#each}}` の中から親のコンテキストは**見えない**（Handlebarsは親スコープへフォールバックしない）。`@root` か `../` を明示する
- **1つのパーツはルート要素を1つだけ返す**。兄弟を並べると `Template part "..." must render a single HTML element.` で描画が落ちる。囲むためだけの要素が必要になったら、`display: contents` を当てて親のレイアウトに影響させないか、パーツ自体を分ける
- コンテキストにない値を参照しても Handlebars は空文字を返すだけで警告しない。`ActorSheetV2` は `actor` を積まないなど、**本体が何を積むかを確認してから使う**（`DocumentSheetV2._prepareContext` が積むのは `document` / `model` / `source` / `fields` / `editable` / `user` / `rootId`）
- `npm run check:templates` が構文・HTMLタグの対応・partialの実在・孤児テンプレートを見る。lefthook の pre-commit でも走る。**CSS側は見ない**ので、規則のないクラス名は自分で確認する

:::

## ダイアログ

ダイアログは本体のフォーム体系に乗せる。自前で組むと、本体が用意している間隔・ラベル配置・ボタン配置をすべて手で再実装することになる。

- **`classes` に `standard-form` を必ず入れる**。本体の `.form-group` / `.form-group.stacked` / `.form-footer` / `fieldset` のレイアウト規則は**すべて `.standard-form` の子孫にスコープされている**ため、これがないと一切効かない
- 独自CSSは、本体で表現できないものだけに絞る
- ボタンは `footer.form-footer` に置き、既定のボタンに `.default` を付ける
- ルート要素にはアプリの `classes` が付く。テンプレート側で同じクラス名のラッパを重ねない

実装方式は2つあり、使い分けは次のとおり。

| 方式 | 使うとき | 注意 |
|---|---|---|
| `DialogV2.prompt` | 入力を1つ受け取って返すだけの単純なもの | 既定の `classes` は `["dialog"]` のみ。`emoklore` も `standard-form` も付かないので、`classes` オプションで明示的に渡す |
| `HandlebarsApplicationMixin(ApplicationV2)` | 状態や複数のアクションを持つもの | `DEFAULT_OPTIONS` の `classes` に `standard-form` を含める |

`DialogV2.prompt` は中身が `this.wait(...)` なので、変数に取り出すと `this` が外れる点にも注意する。

## シートのヘッダにボタンを足す

シート本文にツールバーを作らず、ウィンドウ枠のヘッダに置く。本文に置くとレイアウトの制約になり、名前やリソースの配置と干渉する。

- ドロップダウン（⋮）に入れるなら `_getHeaderControls()` を上書きする。宣言的に書け、ローカライズと表示条件も扱える
- 常時見えるアイコンにするなら `_renderFrame()` で `this.window.controls` の前後に差す（閲覧/編集の切り替えボタンがこれ）
- `_getHeaderControls()` はフレームの描画時に評価される。`render()` を呼んでもフレームは作り直されないので、**頻繁に変わる条件を `visible` に入れない**

## 開発時の注意

`vite.config.ts` は `emptyOutDir: false` なので、テンプレートを消したり改名したりすると `dist/` に前のファイルが残る。配布物を作る前に `rm -rf dist` する。
