# UI設計の規約

CSS・テンプレート・ダイアログの規約と、その背後にある設計原則をまとめる。ここがUIに関する規約の正（SSOT）。

貫いている考えは1つ、**寸法を誰が決めるのかをはっきりさせる**こと。固定pxの数値をあちこちに散らすと、中身の量が変わった瞬間に崩れる。崩れた箇所をpxで微調整すると、次はその調整が別の箇所を壊す。この連鎖を断つための規約が以下になる。

見た目そのものの良し悪しは規約では決まらないので、**実機のPNGを並べて判断する**。採取のしかたは[テスト方針](/testing#スクリーンショットの採取)にある。

## 層の責務

`css/emoklore.css` は目次で、`@layer` の宣言と `@import` だけを置く。**目次には規則を書かない**。

| 層 | レイヤ | 持つもの | 持ってはいけないもの |
|---|---|---|---|
| `css/variables.css` | `tokens` | 値（カスタムプロパティ）だけ | セレクタごとの規則 |
| `css/base.css` | `base` | 本体のクラスに当てる下敷き | シート固有の配置 |
| `css/components/` | `components` | 部品の**内部**の構造 | 自分の外側の寸法・位置 |
| `css/applications/` | `applications` | 部品の**配置と外形寸法** | 部品の内部構造 |
| `css/chat/` | `chat` | シートの外に出るチャットカード | `.emoklore` スコープへの依存 |

**部品に位置決めを書かない**。`grid-row` / `grid-column` / 外側の margin / 幅は、置く側（`applications/`）から指定する。これがあるのでNPCシートやアイテムシートを足したときに同じ部品をそのまま使える。

この「配置は部品に勝つ」はレイヤ順が保証する。詳細度を上げて勝ちにいく必要はない。

## カスケードレイヤ

`css/emoklore.css` の先頭で順序を宣言し、各ファイルが自分のレイヤを自分で名乗る。

```css
/* css/emoklore.css */
@layer tokens, base, components, applications, chat;
```

```css
/* css/components/chip.css */
@layer components {
  .em-chip-list { ... }
}
```

`system.json` の `styles` で `layer: "system"` を宣言してある。本体は `foundry2.css` の冒頭で `reset, variables, elements, blocks, applications, compatibility, layouts, system, modules, exceptions` を宣言していて、`system` はシステム用に空けてある。`applications` より後なので本体には勝ち、`modules` には負ける。本体側は `@import "..." layer(system)` の形で読み込む（`templates/views/layouts/main.hbs`）ため、ここで宣言した名前は `system.tokens` … という副レイヤになる。

- **レイヤの宣言は各ファイルの中に書く。** `@import url(...) layer(...)` には寄せない。ファイルを開いた瞬間にどのレイヤか分かるほうがよく、バンドラの `@import` の扱いにも依存しない
- **`@import` の並び順はカスケードに影響しない。** 順序を決めるのは目次の宣言のほう。ビルド後の `dist/emoklore.css` に宣言文そのものは残らないが、ミニファイアが同じレイヤの規則をまとめて宣言順に並べ替えてから落とすので、順序は保たれる
- dev では `tools/vite-plugin-foundry-dev.ts` が全体を `@layer system { ... }` で包む。devと本番で解決結果は一致する
- **レイヤ名を綴り間違えても Foundry は何も言わない。** 未宣言のレイヤは最後（`exceptions` の後）に積まれるので「今より強くなる」形で通ってしまう。DevToolsのStylesペインで `system.<名前>` として出ているかを目で見ること

### 変数を置くスコープ

**テーマで変わる値は `.emoklore` に、変わらない値は `:root` に置く。** チャットカードは `.emoklore` の外に出るので、`.emoklore` に置いた変数はカード側から引けない。**引けない変数を書いても宣言が無効になるだけで、警告は何も出ない** — 角丸が0になって初めて気付くことになる。色はテーマ別ブロックが `.emoklore` を前提にしているのでそのまま、角丸のようにテーマと無関係な値は `:root` に置いて両方から引けるようにする。

これはDOM上のどこに居るかで決まる話なので、セレクタの書き方（下記のスコープの規則）では解けない。

::: tip テーマの2ブロックは触らない
`css/variables.css` の `.theme-dark .emoklore:not(.theme-light), .emoklore.theme-dark` という形は場当たりではない。本体や dnd5e はレイヤを `general` / `specific` に分けて同じ問題を解いているが、**あれはLESSのmixinで値を2回展開できるから成立する**。素のCSSで真似るとライトの値を全部書き写すことになり、いまの2ブロックより悪くなる。
:::

## 寸法の決め方

- **固定pxは「中身が変わらないもの」にだけ許す**。アイコンの枠、バーの高さ、ボーダー幅などがこれにあたる。**文字が入る箱には使わない**
- グリッドアイテムは既定で `min-width: auto` なので、内容が最小幅を押し上げる。**縮めたい列には明示的に `minmax(0, ...)` か `min-width: 0`** を書く。これを忘れると、長い名前や長いラベルが親の枠を破る
- **兄弟の間で数値を手計算で一致させない**。片方を変えるともう片方が黙って壊れ、依存関係がコードのどこにも現れない。共有する寸法は変数に出すか、後述のとおり同じグリッドに載せて解決する

::: warning 例
`.em-resources` の右列を `145px`、共鳴メータ内部を `49px + 56px + 40px = 145px` と書くと、依存関係がコードのどこにも現れないまま両者が結ばれる。片方を変えるともう片方が黙って壊れる。共有する寸法は同じグリッドに載せて解く（下記）。
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

## 間隔

**本体の `--spacer-2` / `-4` / `-8` / `-12` / `-16` を使う**。独自のgap値を書かない。段階が足りないと感じたら、まず本当にその中間値が要るのかを疑う。

寸法にも `rem` を優先する。`20px` のようなpx指定はユーザーのフォントサイズ設定に追従しないうえ、隣の文字と揃わない。

## 色

### 何を本体に任せ、何を自分で持つか

**中間色・テキスト色・境界線・フォーム部品の色は本体に任せる**。テーマの切り替えも、将来のテーマ追加も本体が面倒を見てくれる。

自分で持つのは次の2つだけ。

1. **ブランドのアクセント** — エモクロアの青と、ガイアケアの橙
2. **本体に対応物がない意味色** — HP・MPのようにリソースの種別を表す色

本体側の主な受け皿は `--color-text-primary` / `-secondary` / `-subtle` / `-emphatic`、`--color-data-background`、`--color-border`、`--color-fieldset-border`、`--color-control-hover`、`--button-hover-*`、`--input-*`。中間色の階調が要るときは `--color-warm-1..3` と `--color-cool-3..5`（`--color-cool-5-25` などのアルファ版もある）。

**本体変数はテーマに追従するものを選ぶ**。`foundry2.css` の `@layer variables.base` にある `body.game .app` ブロックの `--color-text-dark-secondary` や `--color-border-dark-tertiary` などはv11系のレガシーで値が固定されており、テーマを切り替えても変わらない。テーマ対応版は `@layer variables.themes` にある。

### 明度はテーマで反転させる

ブランド色は**色相を保ったまま、ライトでは暗く・ダークでは明るく**する。地の色が反転するので、同じ値を両方で使うと必ずどちらかでコントラストが落ちる。

実際に地の色を測ると、ライトが `#DAD8CC`（パーチメント）、ダークが `#0F0D16` だった。同じ青でも `#42A5F5` はダークで7.28:1、ライトではわずか1.85:1しかない。

| 役割 | ライト | 比 | ダーク | 比 |
|---|---|---|---|---|
| アクセント（エモクロア） | `#0B5FA5` | 4.59 | `#42A5F5` | 7.28 |
| ガイアケア | `#A34400` | 4.34 | `#F57C00` | 7.13 |
| HP | `#2E7D32` | 3.58 | `#43A047` | 5.84 |
| MP | `#B3300F` | 4.39 | `#E64A19` | 4.92 |

### コントラストの下限

**文字は4.5:1、バーやアイコンなどのUI要素は3:1**を最低線にする。新しい色を足すときは、ライトとダークの両方の地に対して比を計算してから決める。

計算は地の色をスクリーンショットから拾い、WCAGの相対輝度で出せばよい。目で見て「読める気がする」は当てにならない — 明るい地に置いた色は、見た目の印象より大きく比を割り込む。

### アクセントを使う場所を絞る

**アクセント色はバーの塗りにだけ使う**。ホバーの文字色や枠線には使わない。

使う場所を増やすほど「ここが今の主役だ」という信号が薄まる。それに、本体のボタンは独自のホバー色（`--color-warm-2`、赤み）を持っているので、自前の要素だけアクセント色にすると**同じシートの中でホバーの色が2種類できてしまう**。

### 命名

**役割で名付ける**。`--emoklore-accent` や `--emoklore-hp` のように、その色が何を意味するかを名前にする。`--emoklore-blue` のような色名や、`--emoklore-gray` のような見た目そのものの名前にしない。テーマで値が変わる以上、色名は嘘になる。

`--emoklore-*` の色はライトテーマの値を既定に置く。本体は `prefers-color-scheme` がライトでもダークでもない環境では `body` にテーマクラスを付けない（`client/game.mjs` の `#configureTheme`）ため、テーマ別ブロックだけに色を置くと変数が未定義になる。

### テーマの判定は「一番近い宣言が勝つ」形にする

シートは本体のシート設定でテーマを個別に固定できる。固定すると `DocumentSheetV2._initializeApplicationOptions` がルート要素に `themed` と `theme-light` / `theme-dark` を付ける。

このとき **`.theme-dark .emoklore` のような子孫セレクタだけで書いてはいけない**。ライトに固定したシートでも `body` が `theme-dark` なら一致してしまい、本体設定を切り替えるたびにシートの色が変わる。

自分でテーマを宣言している要素を除外して、近いほうの宣言が勝つようにする。

```css
.theme-dark .emoklore:not(.theme-light),
.emoklore.theme-dark { /* ダークの値 */ }
```

なお個別テーマは**構築時に解決される**（`_initializeApplicationOptions`）。設定を変えても既存のシートインスタンスには反映されないので、確認するときはシートを開き直す。

## プレイモードと編集モード

シートには2本の軸が渡っている。**混同すると「卓中に押し間違えるボタン」か「権限が無いのに押せるボタン」のどちらかができる。**

| コンテキスト | 何を表すか | 出どころ |
|---|---|---|
| `isPlay` | いまどちらのモードか | `applications/document-sheet-mixin.ts` |
| `editable` | このユーザーが書き換えてよいか | 本体の `DocumentSheetV2._prepareContext` |

**線は「卓中の操作か、組み立ての操作か」で引く。**

- **卓中の操作は両モードに出し、`editable` だけで絞る** — 現在HP/MPの入力、装備のチェック、効果の有効/無効、ハウリング反応を外すゴミ箱、判定のトリガ
- **組み立ての操作は編集モードだけに出す** — 追加（＋）・削除・シートを開く鉛筆・並び替えのドラッグ・能力値や技能レベルの入力・最大値の入力

**現在値と最大値は別の軸に置く。** 現在HPは卓中に減るので閲覧モードで触れないと使えず、最大HPは組み立ての値なので卓中に触る理由が無い。共鳴者・NPC・怪異の3シートともこの形に揃えてある。

<!-- Handlebarsの {{...}} をVueの補間として解釈させないため v-pre で囲む -->
::: v-pre
`isEditMode` はコンテキストに積んでいないので、テンプレートでは `{{#unless isPlay}}` と書く。`{{#each}}` の中からは `@root.` を明示する。
:::

### 隠した操作は右クリックに残す

**行のアイコンを閲覧モードで隠すのは誤爆を防ぐためで、操作そのものを封じるためではない。** 隠したぶんは行の右クリックメニューに置き、そちらは**モードで絞らず権限だけで絞る**（dnd5e・draw-steel・ryuutama も同じ割り切り）。

メニューは `EmokloreActorSheet` が1本だけ張っている。足すときの作法は次のとおり。

- **`ApplicationV2#_createContextMenu()` を通す。** `jQuery: false` と `get...ContextOptions` フック（モジュールが項目を足せる口）が付いてくる。`ContextMenu.create()` は ApplicationV2 に対して例外を投げる
- **登録は `_onFirstRender` で1回だけ。** コンストラクタが container に直接リスナを張るので、`_onRender` で作るとリスナが積み上がる
- **`fixed: true` を渡す。** タブは `overflow: auto` なので、注入方式だとメニューが切られる
- 項目の綴りは **`label` / `visible` / `onClick(event, target)`**（`name` / `condition` / `callback` は非推奨）。`label` は本体が `_loc` を通すのでキーをそのまま渡す。`visible` は開くたびに評価される
- 行には `data-document-class` と `data-item-id` / `data-effect-id` を持たせる。`utils/sheet.ts` の `getEmbeddedDocument` がこれで引く

**本体は、座標を持たない合成イベントに対して、見えていないターゲットのメニューを開かない**（`_setFixedPosition` の `checkVisibility`）。テストから右クリックを再現するときは、タブを開いたうえで `clientX` / `clientY` を渡す。

## 操作できることを示す

**クリックできるものは、ホバーで必ず反応させる**。カーソル形状だけでは弱い。

反応のさせ方は、その要素が何であるかで分ける。

### ボタンは本体のボタンに任せる

`<button>` の地・枠・角丸・ホバーは**本体の `--button-*` がすべて持っている**。自前で塗り直さず、本体の見た目のまま使う。基準はサイドバーの「キャラクター作成」ボタンで、ホバーで `--color-warm-2` の赤に反転するあの挙動が、Foundryのボタンの標準的な触り心地になる。

自前で持つのは並べ方と寸法だけにする。ホバー色を中立に差し替えると、シートの中だけ本体と手触りが違うUIができてしまう。

`--button-hover-*` を再定義するのは、**本体の見た目では成立しない理由があるときだけ**にする。そのときも `background-color` を上書きするのではなく変数を差し替える。上書きは詳細度やレイヤーの勝ち負けに依存するうえ、本体が塗り方を変えると崩れる。

**アイコンボタンの大きさは `--button-size` で決める**。本体の `button.icon` はこの変数から `width` / `height` を取る（`.inline-control` の既定は24px）。`font-size` だけ上げると字面が箱をはみ出し、ホバーの背景が欠けて形が崩れる。

### 行やリスト項目は地の明るさで示す

ボタンではないもの（技能行のような一覧の行）は、`--emoklore-hover-surface` を薄く敷いて示す。ボタンと同じ赤で塗ると、一覧の中で押せる場所が主張しすぎる。

- 押せる範囲と、ハイライトされる範囲を一致させる。文字だけがリンクで行全体が光るのは嘘になる。当たり判定を広げたいときは擬似要素を敷いて範囲を合わせる
- 四角い枠で囲むのは最後の手段。地の色と文字色の変化で足りることが多い

### フォーカス

**キーボードのフォーカスも見えるようにする**。`:focus-visible` にアウトラインを出し、色は本体の `--button-focus-outline-color` を使う。ホバーだけ実装して終わりにしない。

## マークアップ

- 自前のクラスはすべて **`em-` 接頭辞 + BEM風**（`.em-meter`, `.em-meter__value`, `.em-progress--hp`）。`.value` や `.label` のような汎用名は他モジュールのCSSと衝突するので作らない
- Foundry本体のクラス（`.window-content` `.tab` `.sheet-header` `.form-group` `.form-footer` `.flexrow` `.editor-container` `.hint` `.inline-control` `.draggable`）と、`formGroup` が生成する `span.label` はそのまま使う。**`em-` を付けてはいけない**
- `data-*` 属性はJSのフック専用。CSSセレクタに使わない

### 共有する部品を作る基準

`css/components/` にある `em-button` / `em-avatar` / `em-tag` / `em-terms` / `em-meta` は、複数の場所に書き写されていたものを1つにまとめた部品になる。合成して使う。

```hbs
<button class="em-button em-button--inline em-chip">
```

新しく部品を切り出すかは、次の3つが**すべて**当てはまるかで決める。

1. 2箇所以上で繰り返されている
2. その塊が**決めごとを含んでいる**（どの宣言で本体の `--button-size` を外すか、枠線を消して角を丸めるか、など）
3. 片方を変えたらもう片方も変わってほしい

`overflow: hidden; text-overflow: ellipsis; white-space: nowrap` の3行は8箇所にあるが、**部品にしていない**。2を満たさないため — CSSの定型句で、読めばそのまま意味が分かり、ずれようがない。数が多いことは理由にならない。

### セレクタのスコープ

**自前の `em-` クラスを狙う規則はスコープで包まない。** 接頭辞が衝突を防ぐので `.emoklore` を重ねる必要がなく、重ねると詳細度が一段上がって「上書きするには何段必要か」を数える羽目になる。

```css
@layer components {
  .em-chip-list { ... }   /* ← .emoklore で包まない */
}
```

**`.emoklore` が要るのは本体のクラスや素の要素を狙うときだけ**で、それは `css/base.css` に集める。個々のシートに閉じた配置は `.emoklore.sheet.character` のように対象そのものを書く（これはラッパではない）。

### クラスを置く粒度

**CSSの規則もJSのフックも無いクラスは置かない。** 部品の内部の構造的な子は要素セレクタで当てる。

```css
.em-kai__block h3 { ... }   /* .em-kai__block-title を作らない */
```

フックとしてだけ生きているクラスは残してよい。ただし条件は、**何がそれを掴んでいるかがコードから追えること**。チャットカードの `CARD.root` は宣言側を見れば用途が分かるのでこれでよい。追えないものにはコメントを書く（`chat-controls.ts` の二重挿入防止がこれにあたる）。

書いておかないと、次に読む人が「規則を消し忘れたのか、まだ書いていないのか」を判断できない。

`npm run check:templates` は**CSS側を見ない**ので、これは自分で確認する。
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

## 翻訳は本体に解決させる

TS側で翻訳を引くときは本体のグローバル `_loc` を使う（`game.i18n.localize` に束縛されたもので、本体自身がこれを使う。型は `client/global.d.mts` に出ている）。

**本体が `_loc` を通す場所には、キーをそのまま渡す。** 自前で引くと、本体が同じことを二度やるうえ、キーで書けることが読む人に伝わらない。

<!-- Handlebarsの {{...}} をVueの補間として解釈させないため v-pre で囲む -->
::: v-pre

| 場所 | 渡すもの | 本体の解決先 |
|---|---|---|
| `ApplicationV2` の `window.title`、`_getHeaderControls` の `label` | キー | `ApplicationV2#title` の `_loc` |
| `DialogV2` の `ok.label` / `buttons[].label` | キー | `DialogV2` のボタン組み立て |
| `data-tooltip` | キー | `TooltipManager` が `game.i18n.has()` で判定して解決 |
| `CONFIG.statusEffects` の `name`、`system.json` の `packs[].label` | キー | `ActiveEffect.fromStatusEffect` / `CompendiumCollection` |
| スキーマの `label` / `hint` / `placeholder` | `lang/*.json` の `FIELDS` に書く | `i18nInit` の `localizeSchema` |
| `TABS` のタブ名 | `labelPrefix` にキーの接頭辞 | `_prepareTabs` が `.<タブid>` を足す |

展開が要るとき（`{{localize "KEY" name=...}}`）だけ、テンプレートかTS側で解決する。

**フォームの入力はスキーマから描く。** `{{formGroup フィールド value=...}}` はラベル・ヒント・入力欄をまとめて出し、`{{formInput}}` は入力欄だけを出す。どちらも `label` / `hint` / `placeholder` をフィールドから読むので、**テンプレートに文字列を書かなくてよい**。`choices` にi18nキーが入っている場合だけ `localize=true` を添える。

- 配列の要素のフィールドは `<配列>.element.fields.<名前>` に居る（本体が要素の `name` を `"element"` に固定する）。キーの側も `FIELDS.<配列>.element.<名前>` になる
- **要素まで辿る道はテンプレートに書かない。** 読めなくなるので、`applications/` のコンテキスト整形で解決して積む
- 閲覧モードの読み取り専用表示も、ラベルは `{{systemFields.<名前>.label}}` から引く。スキーマに無い派生値（武器のダメージ式など）だけキーを直接引き、理由をコメントに書く

:::

## 同じ入力を2箇所に描かない

シートはルート要素が1つの `<form>` で、`submitOnChange: true` で動いている。**同じ `name` の入力を2箇所に描くと、値が壊れる。**

`FormDataExtended` は可視性をまったく見ない。`#processFormFields` が除外するのは「name がない」「button」「disabled」「readOnly」だけで、`display: none` も `hidden` も `visibility` も判定しない。そして同名が2つあると `#getFieldValue` が配列にまとめるので、`StringField._cast` の `String(["4","4"])` が **`"4,4"` として保存される**。NumberField なら `Number(["4","4"])` が `NaN` になって送信全体が失敗する。**どちらも警告は出ない。**

これが効いてくるのがタブだ。本体は非アクティブなタブを `.tab[data-tab]:not(.active) { display: none }` にするだけで、**DOMには残す**。つまり隠れたタブの入力も毎回まとめて送信される。

- 同じデータを複数のタブに出したくなったら、**描く場所を1つに決める**
- どうしても両方に出すなら、片方は `name` を付けない（`data-*` と手動ハンドラにする）か、`<span>` で表示するだけにする
- 一度に1つしか出ないなら、Handlebarsの if / else で排他に描き分ける

## タブに属さないパートの作り方

全タブで見えていてほしいもの（サイドバーなど）は、**タブの外に独立したパートとして置く**。上の問題が原理的に起きなくなり、スクロール位置や入力中の値も保たれる。

`changeTab`（`api/application.mjs`）は `render()` を呼ばず `classList.toggle("active", ...)` するだけなので、**`class="tab"` と `data-group` を持たない要素はタブ切替で一切触られない**。本体自身が `CategoryBrowser` / `JournalEntrySheet` / `ActiveEffectConfig` で同じ構造を使っている。

パートは `.window-content` 直下に兄弟として並ぶ。入れ子は作れないので、**横に並べたければグリッドで配置する**。

```css
.window-content {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  grid-template-rows: auto auto minmax(0, 1fr);
}
.em-sheet-header, nav.tabs { grid-column: 1 / -1; }
.em-sidebar { grid-column: 1; grid-row: 3; }
section.tab { grid-column: 2; grid-row: 3; overflow: auto; }
```

本体が `.window-content` に `overflow: hidden` を入れているので、各パートに `overflow: auto` を置けば独立してスクロールする。スクロール位置を再描画から守るには `PARTS` の `scrollable` に宣言する。

**畳んで消せるようにするなら、間隔もその要素自身に持たせる。** グリッド側の `column-gap` に置くと、幅を0にしても隙間だけが残る。

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

## 検討して採らなかったもの

CSS設計を見直したとき（2026-07-27）に一度検討し、理由があって採らなかったもの。同じ検討を繰り返さないために残す。

| やらないこと | 理由 |
|---|---|
| `@scope (.emoklore)` | viteの build target（`safari16.4`）より新しい。`to (...)` のドーナツ穴が要る場面が無く、`em-` 接頭辞でスコープを外したいまは平坦化の利点も既に得ている。draw-steel は使っている |
| `light-dark()` | 本体は `color-scheme` を4箇所でしか設定しておらず、テーマは `body.theme-dark` / `.themed.theme-dark` のクラス駆動。前提が無い |
| テーマを `general` / `specific` のレイヤに分ける | 本体と dnd5e はこの形だが、**LESSのmixinで値を2回展開できるから成立する**。素のCSSで真似るとライトの値を全部書き写すことになり、いまの2ブロックより悪くなる |
| `styles` を複数エントリにして `variables` / `elements` レイヤへ入れる（draw-steel方式） | viteの lib mode は `cssFileName` が単一値でCSSを1枚しか出せない。得るのは変数を本体の `variables` レイヤに沈められることだけで、困りごとに対応しない |
| BEMをやめる / `data-*` をCSSセレクタに使う | 冗長さは重複の症状で、命名規則の問題ではない。部品を共有すれば長い名前自体が減る |
