# コード設計の規約

TypeScriptの型と、モジュールの分け方に関する規約はここが正（SSOT）。セットアップやコミット規約は [コントリビュートガイド](/contributing)、層ごとの責務と既知の構造的課題は [アーキテクチャ](/architecture)、CSSとテンプレートは [UI設計の規約](/ui-design) にある。

貫いている考えは1つ、**型に嘘をつかせない**こと。値が取りうる集合を型で持ち、外から来たものは境界で確かめてから名乗る。嘘をついた型は、その場では通るかわりに、実行時の `TypeError` か、あるいは「型が `undefined` にならないと言っているのに `?.` で防御している」ような、読んだ人が信じられないコードになって返ってくる。以下はそれを避けるための規約になる。

## 層とimportの方向

責務の表は [アーキテクチャ](/architecture) にある。ここでは**どちらからどちらへimportしてよいか**だけを決める。

| 層 | importしてよい先 |
|---|---|
| `config/` | なし（表どうしがキーの型を参照するのは可） |
| `rules/` | `config/`（型のみ） |
| `dice/` | `rules/` |
| `data/` | `config/` `rules/` `utils/` |
| `chat/` | `config/` `rules/` `data/` `utils/`。`dice/` `documents/` は型のみ |
| `documents/` | `config/` `data/` `rules/` `dice/` `chat/` `utils/` |
| `applications/` | 上のすべて |
| `utils/` | `config/` `rules/`。`data/` `documents/` は型のみ |

- **`rules/` は何にも依存しない**。Foundry APIもi18nもUIも触らない。だから `vitest` の `environment: "node"` でそのまま動く。逆に言えば、テストしたいロジックはこの層に切り出す
- **`constants.ts` と `settings.ts` はどの層から読んでもよい**。表に行を作っていないのは、層ではなく横断する道具だから。ただし `rules/` だけは例外で、**設定を読ませない** — 読んだ瞬間に純粋関数でなくなる。自動化を切るかどうかの判断は呼び出し側（[アーキテクチャ](/architecture)「自動化の程度」の表）に置く
- **`import type` は依存の矢印を消さない**。型だけのimportはビルド後に消えるので、importグラフ上は逆依存が見えなくなる。**型だけ借りているのか、動かしているのかは分けて考えること** — `utils/sheet.ts` が `EmokloreActor` を型で借りるのは、所持アイテムと効果を引くだけで動かさないので借用。`actor.update()` を呼び始めたらそれは上の層を動かしているので、置き場所は `utils/` ではなく `documents/` になる（保管所の取り込みが `EmokloreActor#importFromCharSheet` にあるのはこのため）

現状の例外は1つで、[アーキテクチャ](/architecture) の「既知の構造的課題」に記録してある。`config/index.ts` が事前ローカライズの登録のために `utils/` をimportしている。

**`data/` の行に `documents/` を足してはいけない。** 表は既に `documents/` → `data/` を許しているので、足すと表そのものが2層間の相互依存を許可することになり、順序を決めるための表が順序を失う。チャットカードのボタンハンドラは判定やダメージ適用を駆動するためこの矢印を欲しがるが、**そこは表ではなくハンドラの置き場所で解く** — ハンドラは `applications/` に置き、`ACTIONS` へ外から登録する。

**`chat/` から `data/` は値でも引いてよい。** カードの状態の型（`WeaponCardState` など）とボタンの出し分け（`resolveCardButtons`）はスキーマと同じ場所に置いてあり、`chat/` はそれを読む側になる。逆向き（`data/` → `chat/`）は無い。

**`chat/` から `dice/` は型だけ。** 判定結果を流す `createRollMessage` が `EmokloreRoll` を引数の型に持つ。Rollを作って評価するのは `documents/` 側で、`chat/` は受け取って `ChatMessage` に載せるだけなので、値では引かない。

**ダイアログを開くかどうかは `applications/` が決める。** `documents/` のメソッドは検証済みの値を必須引数で受け、ダイアログを知らない。入力を集めてから呼ぶ入口は `applications/rolls.ts` にある。dnd5e は `Actor5e#rollSkill(config, dialog, message)` のようにDocument側がダイアログの可否まで持つが、それは**あちらのダイアログがRollクラスの静的メンバー（`BasicRoll.build`）で、パイプライン全体がRollの関心にある**ためで、こちらの事情とは違う。

**判定ダイアログも `applications/` に置く。** `EmokloreRoll.fromSpec` は決まりきった `RollSpec` を式に写すだけなので、ダイスボーナスや成功数修正が組み直す相手はその手前の `SkillRollParams`（`rules/` への入力）になる。`dice/` に置くと、`DialogV2` と `game.i18n` のために表へ `dice/` → `config/` `utils/` を足すことになり、「Roll / Die / 結果の表現」という薄い層でなくなる。

## 文字列で持たない

キーが有限に決まっているものは、`string` ではなくその集合の型で持つ。定型はこの3行になる。

```ts
const definitions = {
  investigation: { label: "EMOKLORE.Config.skillGroups.investigation" },
  // ...
} satisfies Record<string, SkillGroupsConfig>;

export type SkillGroupKey = keyof typeof definitions;

export const skillGroups: Record<SkillGroupKey, SkillGroupsConfig> = definitions;
```

`satisfies` だけだと各値が個別の狭い型に推論されるので、値の型は注釈で揃える。キーは literal のまま保たれるので `keyof typeof` で取り出せる。**`Record<string, SkillGroupsConfig>` と注釈してはいけない**。キーが `string` に潰れて `keyof` が使えなくなる。

**表と表のあいだの参照も型で持つ。** 技能の定義が持つ「どの能力値で振るか」「どの技能グループか」は、`string` ではなく `CharacteristicKey` / `SkillGroupKey` で宣言する。`group: "athletc"` のような綴り間違いはこれで代入不可になり、TypeScriptが正しい綴りを提案する。`string` のままでは、誤記を目視で見つけるまで気付けない。

有限キーの `Record` を引くと `noUncheckedIndexedAccess` でも `undefined` が付かない。**だから `?.` や `?? ""` を書かない**。書くと「型は undefined にならないと言っているのに防御している」状態になり、どちらが正しいのか読んだ人に分からなくなる。

`Object.entries` はキーを `string` に広げてしまうので、有限キーの表を回すときは `module/utils/object.ts` の `typedEntries` を使う。キャストを呼び出しごとに散らすかわりに、ここ1箇所に閉じ込めてある。

## 境界で検証する

**外から来た文字列を、確かめずに型として名乗らない。** 境界は3つある。

| 境界 | 例 | やること |
|---|---|---|
| DOMのdataset | `data-skill` の値 | 型述語を通す |
| ユーザーが貼るJSON | ココフォリア形式の取り込み | `unknown` で受けて絞る |
| 保存データ | `system.skill` に入っている技能キー | 使う前に確かめる |

型述語は表の隣に置く。

```ts
export const isSkillKey = (value: string): value is SkillKey => value in skills;
```

`as SkillKey` と名乗るだけでは、綴り間違いが型を素通りして、その先で `CONFIG` を引いた結果を分割代入したところで `TypeError` になる。実際に `getSkillRollContext` がその形だった。検証は文字列が入ってくる場所で1回だけ行い、そこから先は型が保証する。

**`declare` で名乗った型は保存データが裏切りうる。** `WeaponDataModel#skill` は `AttackSkillKey` と宣言してあるが、実体は `StringField` なので、手書きのデータや `CONFIG` を触るモジュール、フックからの差し替えで別の値が入りうる。スキーマの `choices` は入力を絞るだけで、保存済みの値を遡って直しはしない。

**組み合わせが有り得ない状態を型で作れないようにする。** かつて技能判定は `(skill: string, { base: boolean })` の組で渡しており、「`base: true` に通常技能のキー」という存在しない組み合わせが書けてしまった。判別可能unionにすれば、種別とキーが必ず対応する。

```ts
export type SkillRef =
  | { kind: "skill"; key: SkillKey }
  | { kind: "base"; key: BaseSkillKey };
```

戻り値も同じ。`{ valid: boolean; data?: T; error?: string }` は、`valid` を確かめたあとも `data` が任意のままなので、呼び出し側が `data!` と書くしかない。`valid` で判別できる形にすれば、分岐した時点でどちらがあるか決まる。

## 型をどこに置くか

| 置き場所 | 使うとき | 例 |
|---|---|---|
| `module/types/*.d.ts` | アンビエント宣言・本体へのモジュール拡張 | `emoklore.d.ts`（`CONFIG.EMOKLORE`）、`foundry-shim.d.ts`、`css.d.ts` |
| 層ごとの `types.ts` | その層の複数ファイルが共有する型 | `rules/types.ts`、`applications/types.ts` |
| 定義したファイルの中 | その型を作る・返す関数と同じ場所 | `config/*.ts` の `*Config`、`data/character.ts` の `SkillRef` |

**迷ったら定義したファイルに置く。** `types.ts` は「複数のファイルが実際に共有している」ことが分かってから作る。型だけを集めたファイルは、どの型がどこで使われているかを追いにくくする。

## `interface` と `type`

- **`interface` は宣言マージか `extends` が要るとき**。本体の型を拡張する `EmokloreRollOptions extends RollOptions`、configの定義形（`SkillConfig` など）
- **それ以外は `type`**。キーのunion、`keyof typeof`、交差型、判別可能union、行データ

シートのコンテキスト型（`CharacterContext` など）は**閉じた `type` のままにする**。`EmokloreDocumentSheetContext` を `extends` するとキャストは1つ減るが、基底の `[key: string]: unknown` を引き継ぐので `context.charPintSum = 1` のような打ち間違いが型チェックを素通りする（実測で確認済み）。

共通の項目は `SheetContextBase<D, S>` との**交差型**で共有する。交差型には index signature が入らないので、上の性質は保たれたまま同じ8項目を書き写さずに済む。

## 型の名前

CSSの命名規約が [UI設計の規約](/ui-design) にあるのと同じく、型にも決まった接尾辞がある。

| 形 | 意味 | 例 |
|---|---|---|
| `*Key` | `keyof typeof` で取り出したキーのunion | `SkillKey` `CharacteristicKey` |
| `*Config` | `CONFIG.EMOKLORE` に載る定義の形 | `SkillConfig` `AttackSkillConfig` |
| `*Row` | シートに1行として描くための表示用データ | `SkillRow` `BiographyRow` |
| `*Context` | テンプレートに渡すコンテキスト一式 | `CharacterContext` |
| `*Spec` / `*Params` | ルール層の入出力 | `RollSpec` `SkillRollParams` |
| `*Ref` | 「どれを指すか」だけを持つ参照 | `SkillRef` |
| `Emoklore*` | 本体のクラス・型を拡張したもの | `EmokloreActor` `EmokloreRoll` |

## 名前の綴り

**機械で守れるものはBiomeに書いてある**（`useNamingConvention` / `useFilenamingConvention`）。ここには、そのうえで人が判断する必要がある分だけ書く。

- **頭字語は大文字のまま綴る**。`noteHTML` `CharSheetJSON` `formatDMPart` のように `Html` `Json` へ倒さない。本体APIが `enrichHTML` / `toJSON` / `HTMLField` と綴るので、そちらと地続きにしておくほうが読み替えが要らない。Biome側は `strictCase: false` で合わせてある
- **ただし `id` は例外で、`Id` と綴る**（`partId` `actorId` `itemId` `effectId`）。`partId` は本体ApplicationV2の綴りで、本体もこちら側。**頭字語だから大文字、と機械的に広げないこと**
- **モジュール定数はSCREAMING_SNAKE**（`SYSTEM_ID` `SUCCESS_MODIFIER` `SKILL_LEVEL_MAX` `HP_BASE`）。定数として並べるオブジェクトのキーも同じでよい（`{ PLAY: 1, EDIT: 2 }`）。**Biomeは `const` に camelCase も CONSTANT_CASE も許すのでこれは機械で守れない。** 人が見るしかない
- **ファイルとディレクトリはkebab-case**。例外なく守られている（実測で違反0件）ので、`useFilenamingConvention` で固定してある
- **`Emoklore*` を付けるのは、本体クラスを継承して本体の同名概念を置き換えるものだけ**。`EmokloreActor` `EmokloreRoll` `EmokloreCharacterSheet` がそれで、本体に `Actor` `Roll` `ActorSheet` があるから区別が要る。`CharacterDataModel` や `CharSheetImportDialog` のように本体に同名の概念が無いものには付けない
- **`rules/` の動詞は3つに絞る**。`calculate*` は数式（`calculateMaxHp`）、`resolve*` は入力から一意に決まる導出（`resolveSkillRoll`）、`build*` は複合物の組み立て（`buildDamageFormula`）

### `lang/*.json` のキー

名前空間はPascalCaseで切り、その下は camelCase にする（`EMOKLORE.Sheet.character.tab`）。**ドットを含むキーを1本の文字列で書かない** — 本体は読めるが、木として辿れなくなる。**`EMOKLORE` の直下に裸のリーフを置かない**（名前空間と同じ列に文字列が並ぶと、どちらなのかが読めない）。

名前空間の切り方は3つに分かれる。

| 名前空間 | 中身 | 例 |
|---|---|---|
| `EMOKLORE.Config.*` | `module/config/` の表のうち、**層をまたいで使われるもの**。名前は変数名と同じ複数形にする | `Config.skillGroups` `Config.resonantEmotions` |
| `EMOKLORE.<Document>.<種別>.FIELDS.*` | `LOCALIZATION_PREFIXES` が指す先。**プレフィクスと1対1**にする | `EMOKLORE.Item.weapon.FIELDS` |
| それ以外 | 画面・カード・ダイアログごとの文字列 | `EMOKLORE.ApplyDamage` `EMOKLORE.EmotionPicker` |

**`FIELDS` を持つ名前空間に、横断的な表を混ぜない。** かつて `EMOKLORE.Actor` が `character` / `kai`（プレフィクス）と `characteristics` / `skills`（表）の両方を抱えていて、同じ名前空間が2つの意味を持っていた。表がその種別でしか使われないなら下に置いてよい（`Item.skill.Category` はカスタム技能アイテム専用）。

**装飾込みのフォーマット文字列は `EMOKLORE.Format.*` にまとめる。** 記号だけを翻訳のキーにすると、その記号を使う側が組み立てを持つことになり、言語ごとに語順や約物を変えられない。

## アサーション（`as`）の使いどころ

**`as` は本体APIとの境界に寄せ、`config/` と `rules/` には1つも置かない。** この2層はFoundryに依存しないので、キャストが要る場面が無い。逆に、純粋なはずの層にキャストが現れたら、それは型付けの失敗ではなく層の設計が崩れている合図になる。

- **`as unknown as` の二重キャストは lint で禁止**している（`tools/no-double-cast.grit`）。まず素の `as` で通るか試すこと。アサーションの判定は代入可能性より緩いので、代入で弾かれても `as` 単体なら通ることが多い。本当に必要なときは直前の行に `// biome-ignore lint: 理由` を付ける
- **確かめたうえで名乗り直しているなら、型述語にできる**。`if (this.type !== "weapon") throw` の直後に `as WeaponDataModel` と書いていたのがこれで、`isWeapon(): this is ...` にすると確認がそのまま絞り込みになる
- **キャストの理由はコメントに書く**。「本体のどの型が足りないのか」を具体的に書く。読んだ人が本体を読み直さずに済み、本体が直ったときに消せる

## 本体の型が足りないとき

型定義はFoundryVTT本体ソース（`client/` / `common/`）を `tsconfig.json` の `paths`（`@client/*` / `@common/*`）で直接参照する。本体のJSDocがそのまま型になるので、インストール中のFoundryと型が常に一致する。fvtt-typesは採らない — v14対応が無く、本体の更新のたびに型の追従を待つことになる。レガシーグローバル（`Hooks` / `Actor` など）は `module/types/foundry-shim.d.ts` が本体の名前空間へ橋渡しし、`CONFIG.EMOKLORE` は `module/types/emoklore.d.ts` のモジュール拡張で足している。本体JSにはTSのバインダが解釈できない記法が少数あるため、`npm run typecheck`（`tools/typecheck.mjs`）は `foundry/` 内の診断を除外して判定する。

この方式でも、本体がJSDocで型を持つ以上、実行時に定義されるプロパティやミックスインの継承は型に出てこない。対処は2つだけ。

- **スキーマ由来のプロパティは `declare` で補う**。`declare system: CharacterDataModel;` のように、サブクラスで宣言し直す
- **足りないメンバーは交差型で補う**。`any` で潰さず、**実際に使うメンバーだけ**を足す。`type CardMessage = ChatMessage & { rolls: Roll[]; update: ... }` のように、必要な分だけ書く

**mixinを通すと、インスタンス側だけでなく静的側も落ちる。** 本体のmixinは JSDoc の引数型が `@param {Constructor<ApplicationV2>}` のようにインスタンス側しか宣言していないため、返り値の型から基底クラスの静的メンバーが消える。`DEFAULT_OPTIONS` / `TABS` を `override` で名乗ると TS4113 になるのがこれで、`ApplicationV2Statics` を交差させて補ってある。同じ理由で `User` は `ClientDocumentMixin(BaseUser)` 由来の `isGM` を型に持たない。

**本体側に実体があるものは `declare` で宣言し直さない。** 本体が getter で持つメンバー（`EmokloreActor#sheet` など）を `declare` で上書きすると TS2610 になる。補うのは型に出ないものだけ。なお、この種の誤りはコンパイラのバージョンが上がって初めて検出されることがある — **通っていることは正しさの証明にならない**。

`declare` で名乗るということは「実体がこの形であることを人が保証する」ということなので、**保証できる根拠を一緒に書く**。たとえば武器シートの `item` を武器に絞れるのは、`registerSheet` に `types: ["weapon"]` を渡しているからで、それをコメントに書いておく。

## DataModelのスキーマ

**スキーマ定義と `declare` の二重管理は避けられない。** 本体のフィールドクラス（`common/data/fields.mjs`）はジェネリックではなく、`@template` を持つのは `ArrayField` だけ。つまり `SchemaField` の中身からデータの型を導く道が本体側に無い。かつて型引数でスキーマの型を持ち回す形になっていたが、クラス本体で使われておらず何も制約していなかった。**効かない型引数は、無いより悪い**。

二重管理が前提になるので、ずれにくくする側で工夫する。

- **繰り返すフィールドは関数に寄せる**。修正値の組（`bonus` / `success` / `target`）は4箇所に出てくるので `modifierField()` にまとめてある。対応する型 `ModifierSet` と1対1で向き合う場所を1つにするため
- **`prepareDerivedData` は配線だけにする**。計算は `rules/` の関数を呼ぶ。派生値であることが分かるよう、`declare` の側にもコメントを残す
- **`choices` の値には翻訳済み文字列ではなくi18nキーを入れる**。テンプレートが `formInput` に `localize=true` を渡していれば描画時に本体が解決する。ここで翻訳を引くと、スキーマ定義が i18nInit より先に走ったときに壊れる
- **表示名のプロパティは `label` と `labelKey` で呼び分ける**。`module/config/index.ts` の `preLocalize` に登録した表は `label` を持ち、i18nInit で翻訳済みの文字列に差し替わる。登録しない表（`choices` と共有するため差し替えられないもの）は `labelKey` を持ち、読む側が翻訳する。**同じ名前で意味が変わらないようにするのが要点**で、間違えて素で使うとプロパティが無いのでコンパイルエラーになる
- **`label` はスキーマ定義時に設定しない**。本体の `localizeSchema` は `this.label ||= ...` なので、定義時に入れた値が `lang/ja.json` の `FIELDS` の指定に勝ってしまう
- **新しい種別は `system.json` の `documentTypes` にも宣言する**。`CONFIG.*.dataModels` に登録しただけでは作成できず、警告も出ない。宣言しない種別を登録すると、到達できないのに `system` の型だけが増えて嘘になる

## 厳格フラグ

有効にしているフラグの一覧は `tsconfig.json` にある（数を本文に書くと古くなるため、ここには写さない）。書き方に効くものだけ挙げる。

- **`any` は lint で禁止**（`noExplicitAny`）。本体の型が足りないときは `any` で潰さず交差型で補う。抑制してよいのは交差型でも表現できないとき（mixin のコンストラクタ制約がそれ）だけで、必ず理由コメントを付ける
- **`exactOptionalPropertyTypes` が有効**。任意プロパティに明示的な `undefined` を入れうる場合は `foo?: T | undefined` と書く
- **`verbatimModuleSyntax` が有効**。型だけのimportは `import type` と書く

以下は**入れなかったものと、その理由**。同じ検討を繰り返さないために残す。フラグを増やすときは、**推測ではなくフラグごとにエラー数を実測してから決めること**。

| 見送ったもの | 実測 | 理由 |
|---|---|---|
| `noPropertyAccessFromIndexSignature` | 28件 | ほぼ全部 `dataset.rollType` → `dataset['rollType']`。DOMのdatasetに対して読みにくくなるだけ |
| `lib: ES2025` / `ESNext` | 1件 | 武器カードの `parent` のキャストが comparability を失う（`weapon-card.ts` の `this.parent as CardMessage`）。ES2024までは0件なので、そちらに固定している。二重キャストは禁止しているので、直すなら型述語か構造の側 |
| `checkJs` + `tools/` `tests/` を `include` | 99件 | ページに注入するグローバル（`__waitFor` など）とコールバックの暗黙 `any` が大半で、型を付けるには注入側の宣言が要る。1件ずつ当たった結果、実行時に壊れるものは無い。**件数は当たるべき対象の量であって、中身の証拠ではない** |
| `types: ["node"]` の分離 | — | ブラウザ向けコードにNodeのグローバルが載るが、ルートの `vite.config.ts` が同じ `include` にあるため tsconfig を分ける必要がある |
| Biome `preset: all` | 700件超 | `useNamingConvention` 116 / `noMagicNumbers` 51 / `noConsole` 36 / `noTernary` 26 と、大半がノイズ |
| Biome `noUnnecessaryConditions` | — | `actor-sheet` の `switch` を unreachable と誤検出する。Biomeは型情報を持たないため `dataset.rollType` を推論できない。**実機で3経路とも通ることを確認済み** |
| Biome `useAwait` | 7件 | 本体API契約上 `async` が必須のハンドラを咎める |
| Biome `useImportExtensions` | 90件 | bundlerの解決方式と噛み合わない |

Biomeは型情報を持たないので、型に関する検査はすべて `tsc` 側にある。組み込みルールに無いものは**GritQLプラグインで書けることがある**（二重キャストの禁止がそれ）。「Biomeでは無理」と決める前にプラグインを検討すること。

## コメント

**何をしているかはコードが持ち、コメントはコードに現れないことだけを持つ。** 処理をなぞる再述は書かない。

書くもの:

- **本体の仕様への依存**。「本体のシートは `phase` を hidden でしか持たない」のように、このコードの形を外から強制している事実。読んだ人が本体を読み直さずに済む
- **一見不要・一見誤りに見えるコードの理由**。消したくなった人を止める1文
- **型の主張の根拠**。キャストの理由、`declare` の保証根拠、`biome-ignore` の理由。それぞれの定めは上の各節にあるとおり
- 回帰テストには**防いでいる事故を現在形で**書く。「何が起きたか」ではなく「何が起こりうるか」

書かないもの:

- **経緯**。「以前は」「かつて」で始まる物語は書かない。過去の事故が理由なら現在形の条件文に直す —「以前はXしていて壊れた」ではなく「Xすると壊れる（のでYする）」。同じ情報で、古くならない。履歴は `git blame` とPRが持つ
- **本体のバージョン差分の物語**。本体の挙動は現在形で書く（「v14で〜になった」ではなく「本体は〜する」）。本システムはv14専用で、v13との差分に意味は無い
- **閉じたIssue・マージ済みPRの番号**。書いてよい番号は2種類だけ。**未解決の制限を追跡するopen Issue**（閉じるときに修正と一緒に消す）と、**主張の証拠がIssueにしか無いもの**（番号は証拠の置き場所への参照であって、経緯の参照ではない）。どちらも、番号を読まなくてもコメント単体で意味が通る文にする
- **未対応の計画の詳述**。何をやるかは[ロードマップ](/roadmap)とIssueが正。コメントに書くのは「いまの形が意図的である理由」まで

長さは**結論を1文目に置く**ことで決まる。設計の背景がひと段落で収まらないなら、それはdocsの話題なので、docsの該当節に置いてコメントは1文と参照にする。

<!-- Handlebarsの {{...}} をVueの補間として解釈させないため v-pre で囲む -->
::: v-pre
テンプレートとCSSの節見出し（`{{! Weapon Card }}` や `/* Layout */`）はブロックの題として書いてよい。partialの先頭の `@param` は必須（[UI設計の規約](/ui-design)が正）。
:::
