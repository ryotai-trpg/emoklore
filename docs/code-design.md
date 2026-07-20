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
| `documents/` | `config/` `data/` `rules/` `dice/` `utils/` |
| `applications/` | 上のすべて |
| `utils/` | `config/` `rules/`。`data/` `documents/` は型のみ |

- **`rules/` は何にも依存しない**。Foundry APIもi18nもUIも触らない。だから `vitest` の `environment: "node"` でそのまま動く。逆に言えば、テストしたいロジックはこの層に切り出す
- **`import type` は依存の矢印を消さない**。型だけのimportはビルド後に消えるので、importグラフ上は逆依存が見えなくなる。`utils/queries.ts` が `actor.applyDamage()` を呼んでいるのがこれで、型だけ借りているように見えて実際は上の層を動かしている。**型だけ借りているのか、動かしているのかは分けて考えること**

現状の例外は2つあり、どちらも [アーキテクチャ](/architecture) の「既知の構造的課題」に記録してある。`documents/actor.ts` がダイアログを開くために `applications/` を、`config/index.ts` が事前ローカライズの登録のために `utils/` をimportしている。

## 文字列で持たない

キーが有限に決まっているものは、`string` ではなくその集合の型で持つ。定型はこの3行になる。

```ts
const definitions = {
  investigation: { label: "EMOKLORE.Actor.skillGroup.investigation" },
  // ...
} satisfies Record<string, SkillGroupsConfig>;

export type SkillGroupKey = keyof typeof definitions;

export const skillGroups: Record<SkillGroupKey, SkillGroupsConfig> = definitions;
```

`satisfies` だけだと各値が個別の狭い型に推論されるので、値の型は注釈で揃える。キーは literal のまま保たれるので `keyof typeof` で取り出せる。**`Record<string, SkillGroupsConfig>` と注釈してはいけない**。キーが `string` に潰れて `keyof` が使えなくなる。

**表と表のあいだの参照も型で持つ。** 技能の定義が持つ「どの能力値で振るか」「どの技能グループか」は、`string` ではなく `CharacteristicKey` / `SkillGroupKey` で宣言する。`group: "athletc"` のような綴り間違いはこれで代入不可になり、TypeScriptが正しい綴りを提案する。かつて〈毒見〉の誤記を目視で見つけて直したことがあるが（PR #37）、それは型で防げる種類の間違いだった。

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
| `module/types/*.d.ts` | アンビエント宣言・本体へのモジュール拡張 | `emoklore.d.ts`（`CONFIG.EMOKLORE`）、`foundry-shim.d.ts` |
| 層ごとの `types.ts` | その層の複数ファイルが共有する型 | `rules/types.ts`、`applications/types.ts` |
| 定義したファイルの中 | その型を作る・返す関数と同じ場所 | `config/*.ts` の `*Config`、`data/character.ts` の `SkillRef` |

**迷ったら定義したファイルに置く。** `types.ts` は「複数のファイルが実際に共有している」ことが分かってから作る。型だけを集めたファイルは、どの型がどこで使われているかを追いにくくする。

## `interface` と `type`

実測で `interface` 15、`type` 71。使い分けは次のとおり。

- **`interface` は宣言マージか `extends` が要るとき**。本体の型を拡張する `EmokloreRollOptions extends RollOptions`、configの定義形（`SkillConfig` など）
- **それ以外は `type`**。キーのunion、`keyof typeof`、交差型、判別可能union、行データ

シートのコンテキスト型（`CharacterContext` など）は**閉じた `type` のままにする**。`EmokloreDocumentSheetContext` を `extends` するとキャストは1つ減るが、基底の `[key: string]: unknown` を引き継ぐので `context.charPintSum = 1` のような打ち間違いが型チェックを素通りする（実測で確認済み）。

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

## アサーション（`as`）の使いどころ

**`as` は本体APIとの境界に寄せる。** 実測でキャストは58箇所あるが、**`config/` と `rules/` には1つも無い**。これは偶然ではなく、この2層がFoundryに依存しないから起きている。逆に、純粋なはずの層にキャストが現れたら、それは型付けの失敗ではなく層の設計が崩れている合図になる。

| 層 | キャスト数 |
|---|---|
| `config/` `rules/` | 0 |
| `dice/` | 1 |
| `documents/` | 2 |
| `data/` | 5 |
| `applications/` | 17 |
| `utils/` | 22 |
| `emoklore.ts` | 8 |

- **`as unknown as` の二重キャストは lint で禁止**している（`tools/no-double-cast.grit`）。まず素の `as` で通るか試すこと。アサーションの判定は代入可能性より緩いので、代入で弾かれても `as` 単体なら通ることが多い。本当に必要なときは直前の行に `// biome-ignore lint: 理由` を付ける（現在5箇所）
- **確かめたうえで名乗り直しているなら、型述語にできる**。`if (this.type !== "weapon") throw` の直後に `as WeaponDataModel` と書いていたのがこれで、`isWeapon(): this is ...` にすると確認がそのまま絞り込みになる
- **キャストの理由はコメントに書く**。「本体のどの型が足りないのか」を具体的に書く。読んだ人が本体を読み直さずに済み、本体が直ったときに消せる

## 本体の型が足りないとき

FoundryVTT本体はJSDocで型を持つが、実行時に定義されるプロパティやミックスインの継承は型に出てこない。詳しい経緯は [v14移行チェックリスト](/v14-migration) にある。対処は2つだけ。

- **スキーマ由来のプロパティは `declare` で補う**。`declare system: CharacterDataModel;` のように、サブクラスで宣言し直す
- **足りないメンバーは交差型で補う**。`any` で潰さず、**実際に使うメンバーだけ**を足す。`type CardMessage = ChatMessage & { rolls: Roll[]; update: ... }` のように、必要な分だけ書く

**mixinを通すと、インスタンス側だけでなく静的側も落ちる。** 本体のmixinは JSDoc の引数型が `@param {Constructor<ApplicationV2>}` のようにインスタンス側しか宣言していないため、返り値の型から基底クラスの静的メンバーが消える。`DEFAULT_OPTIONS` / `TABS` を `override` で名乗ると TS4113 になるのがこれで、`ApplicationV2Statics` を交差させて補ってある。同じ理由で `User` は `ClientDocumentMixin(BaseUser)` 由来の `isGM` を型に持たない。

この2つは TypeScript 7 で初めて表面化した。**5.9 では通っていたので、通っていることは正しさの証明にならない**。あわせて `EmokloreActor` の `declare sheet` / `declare isOwner` のように、本体が getter で持っているものを `declare` で宣言し直していた箇所も TS7 が検出した（TS2610）。本体側に実体があるものは補わず消す。

`declare` で名乗るということは「実体がこの形であることを人が保証する」ということなので、**保証できる根拠を一緒に書く**。たとえば武器シートの `item` を武器に絞れるのは、`registerSheet` に `types: ["weapon"]` を渡しているからで、それをコメントに書いておく。

## DataModelのスキーマ

**スキーマ定義と `declare` の二重管理は避けられない。** 本体のフィールドクラス（`common/data/fields.mjs`）はジェネリックではなく、`@template` を持つのは `ArrayField` だけ。つまり `SchemaField` の中身からデータの型を導く道が本体側に無い。かつて型引数でスキーマの型を持ち回す形になっていたが、クラス本体で使われておらず何も制約していなかった。**効かない型引数は、無いより悪い**。

二重管理が前提になるので、ずれにくくする側で工夫する。

- **繰り返すフィールドは関数に寄せる**。修正値の組（`bonus` / `success` / `target`）は4箇所に出てくるので `modifierField()` にまとめてある。対応する型 `ModifierSet` と1対1で向き合う場所を1つにするため
- **`prepareDerivedData` は配線だけにする**。計算は `rules/` の関数を呼ぶ。派生値であることが分かるよう、`declare` の側にもコメントを残す
- **`choices` の値には翻訳済み文字列ではなくi18nキーを入れる**。テンプレートが `formInput` に `localize=true` を渡していれば描画時に本体が解決する。ここで `game.i18n` を呼ぶと、スキーマ定義が i18nInit より先に走ったときに壊れる
- **`label` はスキーマ定義時に設定しない**。本体の `localizeSchema` は `this.label ||= ...` なので、定義時に入れた値が `lang/ja.json` の `FIELDS` の指定に勝ってしまう
- **新しい種別は `system.json` の `documentTypes` にも宣言する**。`CONFIG.*.dataModels` に登録しただけでは作成できず、警告も出ない。宣言しない種別を登録すると、到達できないのに `system` の型だけが増えて嘘になる

## 厳格フラグ

有効にしているフラグの一覧は `tsconfig.json` にある（数を本文に書くと古くなるため、ここには写さない）。書き方に効くものだけ挙げる。

- **`any` は lint で禁止**（`noExplicitAny`）。本体の型が足りないときは `any` で潰さず交差型で補う。現在残っている `any` は mixin のコンストラクタ制約1箇所だけ
- **`exactOptionalPropertyTypes` が有効**。任意プロパティに明示的な `undefined` を入れうる場合は `foo?: T | undefined` と書く
- **`verbatimModuleSyntax` が有効**。型だけのimportは `import type` と書く

以下は**入れなかったものと、その理由**。同じ検討を繰り返さないために残す。フラグを増やすときは、**推測ではなくフラグごとにエラー数を実測してから決めること**。

| 見送ったもの | 実測 | 理由 |
|---|---|---|
| `noPropertyAccessFromIndexSignature` | 28件 | ほぼ全部 `dataset.rollType` → `dataset['rollType']`。DOMのdatasetに対して読みにくくなるだけ |
| `lib: ESNext` | 1件 | 武器カードの `parent` のキャストが comparability を失う。ES2024までは0件なので、そちらに固定している |
| `types: ["node"]` の分離 | — | ブラウザ向けコードにNodeのグローバルが載るが、ルートの `vite.config.ts` が同じ `include` にあるため tsconfig を分ける必要がある |
| Biome `preset: all` | 700件超 | `useNamingConvention` 116 / `noMagicNumbers` 51 / `noConsole` 36 / `noTernary` 26 と、大半がノイズ |
| Biome `noUnnecessaryConditions` | — | `actor-sheet` の `switch` を unreachable と誤検出する。Biomeは型情報を持たないため `dataset.rollType` を推論できない。**実機で3経路とも通ることを確認済み** |
| Biome `useAwait` | 7件 | 本体API契約上 `async` が必須のハンドラを咎める |
| Biome `useImportExtensions` | 90件 | bundlerの解決方式と噛み合わない |

Biomeは型情報を持たないので、型に関する検査はすべて `tsc` 側にある。組み込みルールに無いものは**GritQLプラグインで書けることがある**（二重キャストの禁止がそれ）。「Biomeでは無理」と決める前にプラグインを検討すること。
