# アーキテクチャ

現状の構造と、リファクタリング（ロードマップPhase 2）で目指す姿をまとめる。

## 現状の構造

エントリは `module/emoklore.ts`。`init` フックでDocumentクラス・DataModel・シート・ダイス関連を `CONFIG` に登録する。

ビルドの入口も同じファイル。viteの `lib.entry` がここを指し、出力は `dist/emoklore.mjs` と `dist/emoklore.css`（`system.json` が指す先）。CSSの目次を先頭でimportしているのがCSS出力のトリガで、これを外すと `dist/emoklore.css` が生成されない。

```
module/
  emoklore.ts        … エントリ。CSS目次のimport、CONFIG登録、configのラベル事前ローカライズ、開発用フック
  config/            … 静的なゲームルール定義（技能・特性・共鳴感情など）→ CONFIG.EMOKLORE
  data/              … TypeDataModelスキーマ（character / npc / weapon / 武器カードのChatMessage）と派生値計算
  rules/             … ゲームルールの純粋関数（判定計算・成功数）。Foundry非依存でvitest対象
  documents/         … Actor / Item 拡張とGMへの処理委譲（queries）。判定を実行して結果を流す
  applications/      … ApplicationV2シート・ダイアログ、判定の入口（rolls）。ダイアログを開くのはここ
  dice/              … カスタムRoll / Die（成功数判定: 1d10≦目標値、1クリティカル / 10ファンブル）
  utils/             … i18n事前ローカライズ、ActiveEffect整理、チャット生成、ココフォリアインポートなど
templates/           … Handlebarsテンプレート。partials/ は引数を取る再利用部品
css/
  emoklore.css       … @importを並べるだけの目次。規則は書かない
  variables.css      … CSS変数。色はライトを既定にダークだけ上書きする
  components/        … .emoklore の下で成立する部品。位置決めを持たない
  applications/      … module/applications/ と対。部品の配置と寸法
  chat/              … シートの外に出るチャットカード
lang/                … ja.json が正、en.json は追従
```

## 武器カードのフック

戦闘の自動化は他モジュール（midi-qol相当のもの）が引き取れる余地を残したいので、判定とダメージの各段にフックを置いている。`pre` が付くものは `Hooks.call` で呼ぶので、`false` を返すとその場で中断する。完了の通知は `Hooks.callAll` なので戻り値を見ない。命名と使い分けはdnd5eの規約に合わせている。

| フック | 引数 | 中断 |
|---|---|---|
| `emoklore.preUseWeapon` | `(item, messageData)` | できる |
| `emoklore.useWeapon` | `(item, message)` | — |
| `emoklore.preRollAttack` | `(message, config)` | できる |
| `emoklore.rollAttack` | `(message, roll)` | — |
| `emoklore.preRollDamage` | `(message, config)` | できる |
| `emoklore.rollDamage` | `(message, roll)` | — |
| `emoklore.preApplyDamage` | `(actor, amount, updates)` | できる |
| `emoklore.applyDamage` | `(actor, amount)` | — |

`config` はその場で組み立てた設定オブジェクトをそのまま渡しているので、フックの中で書き換えれば判定内容を差し替えられる。攻撃判定なら `skill`、ダメージなら `successCount` / `damageDie` / `attackPower` / `bonus`。`preApplyDamage` の `updates` も同じく、そのまま `Actor#update` に渡る更新データなので書き換えが効く。

**攻撃判定の `config` に `base`（基本技能かどうか）は載せていない。** これは `skill` から一意に決まる値なので、両方を載せると「通常技能のキーに `base: true`」のような矛盾した対をフックの側から作れてしまう。実際、以前は `base` をフックの**前**に算出しており、`skill` だけを差し替えると差し替え前の `base` と組み合わされて技能値が拾えなくなっていた。いまはフックの後に `resolveAttackSkill()` から引き直している。

カードのボタンは `WeaponCardModel.ACTIONS` の表で `data-action` から引いている。モジュールがここにキーを足せば、テンプレートを差し替えずにボタンを増やせる。

〈ストレングス〉による近接武器攻撃力の加算はまだ配線していないが、`buildDamageFormula` の `bonus` が接続点になる。ダメージの軽減も `EmokloreActor#applyDamage` の `reduction` に寄せてある。〈耐久〉判定も防御判定も「受けるダメージを【成功数】点軽減する」という同じ形で、防具を入れるならそれも同じ引き算になるため、口を1つにしておく。

## 効果（ActiveEffect）の載せ方

v14 の ActiveEffect は v13 から作り直されている。`changes` が `effect.system.changes` へ移り、適用モードが `change.mode`（数値）から `change.type`（文字列）になり、**適用が2フェーズになった**。設計に効いているのは最後の1つ。

`prepareData()` は `prepareBaseData` → `prepareEmbeddedDocuments`（ここで `applyActiveEffects("initial")`）→ `prepareDerivedData` → `applyActiveEffects("final")` の順に進む（`client/documents/actor.mjs` の `:431` と `:468`）。つまり **`final` は派生値の計算が終わったあとに走る**。

この2つを次のように使い分けている。

- **`initial`** — 通常。`mod.*` と、能力値・技能レベルのような素の値。ここに乗せたものは `prepareDerivedData` の入力になるので、HP最大値や目標値まで連動する
- **`final`** — 派生値そのものを動かしたいときだけ。`initiative` や `hp.max` は `prepareDerivedData` が毎回入れ直すので、`initial` に乗せても消える

**判定の修正は `mod.*` に寄せる。** 目標値を `final` で直接書いても結果は同じだが、`resolveSkillRoll` を通らないぶんチャットの式に内訳（`(5-2)DM≦`）が出ない。修正は4系統（全体・能力値・技能グループ・技能）を合算する形になっている。

### 保存しないフィールド

`mod.*` と `hp.max` / `mp.max` / `initiative` は `persisted: false` にしてある。前者は効果の着地点としてしか使わず、後者は `prepareDerivedData` が毎回入れ直すので、どちらも保存する意味が無い。

**スキーマには残す。** これが要点で、スキーマにあるフィールドへの効果は `DataField#applyChange` を通り、効果値の Roll 評価（`"@skills.strength.level"` が書ける）と `clean`/`validate`（範囲外は端に丸められる）が効く。スキーマに無いキーは本体が値の型を推測する経路に落ち、どちらも効かない。`initiative` を `declare` だけの派生値からスキーマのフィールドに変えたのはこのため。

dnd5e は同じ用途に `persisted: false` を使っている（旧来の「スキーマ外キーを特別扱いする」方式は 6.0 で非推奨になった）。ただし順序問題の解き方は違っていて、あちらは `FormulaField` に `@` を文字列のまま持たせて評価を後段へ遅らせており、`phase` は使っていない。エモクロアはダイス項を含むボーナスがルールに無く、ダイスボーナスは「振る個数」＝整数なので、式文字列のフィールドは持ち込んでいない。

### 属性キーの選択

`EmokloreActiveEffectConfig` が本体の設定シートの変更行だけを差し替え、属性キーを「対象 × 修正先」の2つの選択から組み立てる。合成と読み取りは `utils/effect-keys.ts` の純粋関数で、`CONFIG` を読まないので単体テストできる。

**読み取れないキーは生の入力に倒す。** `system.initiative` のように選択肢に無いキーも効果としては有効なので、塞ぐと編集できなくなる。

あわせて `phase` を選べるようにしている。本体のシートは `phase` を hidden でしか持たないので、これが無いと `final` を選ぶ手段自体が無い。

## GMへの委譲（クエリ）

Foundryは `Document#update` をサーバ側で権限検査するので、OWNER権限を持たないアクター（多くの場合、敵）はプレイヤーのクライアントからは書き換えられない。ダメージ適用はこれに当たるため、権限を持つGMのクライアントに肩代わりしてもらう。

**生の `game.socket` ではなく本体のクエリ機構を使う**。`CONFIG.queries` にシステムIDで受け口を登録し、送る側は `User#query` を呼ぶ。draw-steel の `DrawSteelSocketHandler` と同じ形。

生ソケットに対する利点は3つ。応答が戻るので結果の組み立てを1箇所にまとめられること、タイムアウトとエラー伝播を本体が持つこと、宛先が1人に決まるので「自分が処理すべきか」の判定が要らないこと。`system.json` の `"socket": true` も不要になる（クエリは core の `userQuery` イベントを通り、`system.<id>` の名前空間を使わない）。

クエリ名は他パッケージと衝突しないようシステムIDを接頭辞にする（接頭辞なしの名前は本体の予約）。`QUERY_USER` 権限は既定でプレイヤーにも与えられている（`common/constants.mjs` の `defaultRole: USER_ROLES.PLAYER`）。

宛先は `game.users.activeGM`。この getter は全クライアントで同じ1人を返すので、GMが複数いても二重に適用されない。自分がその指名GMなら委譲せずその場で処理する。

やり取りするのは**トークンのアクターのUUID**。非リンクトークンの合成アクターは `Scene.<id>.Token.<id>.Actor.<id>` という形のUUIDを持ち、`fromUuid` でそのトークン専用のアクターに解決される（実機で往復を確認済み）。ワールドのアクターのUUIDを送ると、同じ元データから置いた雑魚が全員まとめて減る。

非リンクトークンでも権限は変わらない。合成アクターは元のアクターの `ownership` をそのまま引き継ぐので、プレイヤーから見て敵は依然として書き換えられない。トークン経由にしても委譲は要る。

1体でも触れない対象が混じっていれば、触れるものも含めてまとめてGMに預ける。一部だけ自分で処理すると適用の記録が2件に割れてしまうため。

## 既知の構造的課題

1. **スキーマ定義が `CONFIG.EMOKLORE` に依存**: `module/data/character.ts` がキー集合を得るために定義時点で `CONFIG.EMOKLORE` を読む。`CONFIG.EMOKLORE` を設定するのは自分の `init` フックなので制御下にあるが、他モジュールが `init` 中に `Actor.dataModels.character.schema` へ触ると壊れうる。`TypedObjectField` での解消は検討したうえで見送った（下記）
2. **NPCの扱いが未定**: `NpcDataModel` は `wickedness` しか持たず、シートも判定もない。登録を外したので型の上での嘘は消えたが、NPCをどう表現するかは未決のまま。NPC用シートの実装（Phase 3）で判定まわりごと決める。戻すときは `EmokloreActor#system` が union になるので、NPCで壊れる箇所は型チェックが教えてくれる
3. **`config/` の副作用**: `module/config/index.ts` が import 時に `preLocalize` を呼び、`performPreLocalization` が `CONFIG.EMOKLORE` を破壊的に書き換える。この表の「`config/` に置かないもの」に反するが、dnd5e / draw-steel 由来の確立したパターンなので当面は踏襲する
4. **`utils/charsheet-importer.ts` が2つの顔を持つ**: 純粋なパーサ（`parseSkills` / `parseEmotions` / `validateCharSheetJSON`、単体テスト済み）と、`actor.update()` と `ui.notifications` を持つ適用部（`importFromCharSheet`）が同じファイルにある。後者は `EmokloreActor` を `import type` で借りているので、**この逆依存はimportグラフに現れない**。分割は20〜30行規模だが、`buildImportIndexes()` が `CONFIG.EMOKLORE` を読むため、パーサを完全に純粋化するなら索引を引数で渡す形への変更が要る
5. **`data/messages/weapon-card.ts` がオーケストレータ**: カードのボタンハンドラ（`rollAttack` / `rollDamage` / `applyDamage`）が `actor.buildSkillRoll()` と `applyDamageToTargets()` を駆動し、`ui.notifications` とフックも持つ。`data/` の「置かないもの: UI、チャット生成」に反する。層表の `data/` の行に `documents/` を足して解決してはいけない（表が `documents/` → `data/` を許しているので、相互依存を許可することになる）。直すならハンドラの置き場所のほう
6. **CIの穴**: 型チェックジョブはフォークからのPRで実行されない。理由は2つ重なっており、Actions cacheがフォークから復元できないことと、secretsがフォークPRに渡らないのでキャッシュミス時の `tools/fetch-foundry.mjs` 経路も成立しないこと。lefthookには型チェックもテストも入っていない（`pre-push` 自体が無い）ので、**フォークからのPRは型チェックを一度も通さずに緑になれる**（Issue #7 の範囲）

`weapon` は `documentTypes.Item.weapon` の宣言で到達可能にした（`game.documentTypes.Item` が `["base", "weapon"]` を返すことを実機で確認済み）。**新しい種別を足すときは、データモデルの登録だけでなく `system.json` の宣言が要る。**

Phase 2 で解消したもの:

- ~~**Documentクラスの責務過多**~~: `rollSkill` / `rollResonance` の判定計算を `module/rules/`、ダイアログを `module/applications/dialogs/`、チャット生成を `module/utils/chat.ts` に分離した
- ~~**プレゼンテーション層にルール計算**~~: `applications/helpers.ts` を責務ごとに `rules/character-points.ts` / `utils/sheet.ts` / `applications/helpers.ts` へ分割した
- ~~**`i18nInit` からのスキーマパッチ**~~: config の複製だったラベルを保存するのをやめ、能力値ラベルは `LOCALIZATION_PREFIXES` と `ja.json` の `FIELDS` に載せた
- ~~**スキーマ定義時の `game.i18n` 依存**~~: 能力値選択肢の `choices` に翻訳済み文字列を入れていたのをi18nキーに変えた。テンプレートが `formInput` に `localize=true` を渡しているため、描画時に本体が解決する
- ~~**`as any` の多用**~~: 55箇所あったものをすべて解消し、`biome.json` の `noExplicitAny` を `error` にした。残る `any` は mixin のコンストラクタ制約1箇所のみで、理由コメント付きで個別抑制している
- ~~**開発用ハックの混入**~~: `ready` フックのハードコードされたactor IDを `developerActorId` 設定に置き換えた

Phase 2 のあとに解消したもの:

- ~~**`prepareDerivedData` にルール計算**~~: 技能目標値・HP最大・MP最大・共鳴の下限・行動値の算術を `rules/derived-values.ts` へ出し、`data/` は配線だけにした。〈手当〉の半減がループの後段で目標値を上書きする順序依存だったのも解消した
- ~~**`as unknown as` の二重キャスト**~~: `character-sheet.ts` の5箇所を解消し、`tools/no-double-cast.grit`（BiomeのGritQLプラグイン）で再発を禁止した。本体APIとの境界に残る5箇所は理由付きで個別抑制している
- ~~**`strict: false`**~~: 全フラグを計測したところエラー0件だったので `strict: true` にし、`noImplicitReturns` / `exactOptionalPropertyTypes` / `noUnusedLocals` / `noUnusedParameters` も足した
- ~~**`rules/` から `utils/` への逆依存**~~: `formatDMPart` を `rules/skill-roll.ts` に取り込み、`rules/` を自己完結させた。`documents/` にあった表示整形（`formatSkillName`）は `utils/chat.ts` へ移した
- ~~**攻撃技能の引き方が食い違う**~~: 未知のキーに対する倒し先が4箇所（`data/item-models.ts`、`data/messages/weapon-card.ts` の2箇所、`utils/weapon.ts`）でばらばらで、`base` は真偽が逆、`damageDie` は `d3` と `null` に割れていた。`utils/weapon.ts` の `resolveAttackSkill()` に寄せ、型述語 `isAttackSkillKey` を表の隣（`config/`）に置いた
- ~~**`utils/queries.ts` がオーケストレータ**~~: `actor.applyDamage()` を駆動していてユーティリティではなかった。`documents/queries.ts` へ移した。`EmokloreActor` を `import type` で借りていたぶん、importグラフの上では逆依存が見えていなかったのが解消し、代わりに `data/messages/weapon-card.ts` からの矢印が表に出た（課題5）。**その矢印は移動で生まれたものではない。**`weapon-card.ts` は以前から `actor.buildSkillRoll()` を呼んでいて、同じ隠れ方をしていた
- ~~**`documents/` から `applications/` への逆依存**~~: `documents/actor.ts` が `promptResonanceRoll` をimportし、`rollResonance` の中で「引数が無ければダイアログを開く」と判断していた。入力を集める入口を `applications/rolls.ts` に置き、`rollResonance` は検証済みの強度と一致度を必須引数で受ける形にした（`rollSkill` が `SkillRef` を受けるのと同じ形）。**シートの共鳴ボタンを押すとダイアログが出る挙動は変えていない。**変えたのはその判断をどの層が持つかだけ
- ~~**同じ定数を2箇所で宣言**~~: 技能レベルの範囲を `utils/charsheet-importer.ts` がローカルに書き写していた。`rules/limits.ts` を新設して能力値と技能レベルの範囲をまとめ、`data/` `applications/` `utils/` の3層が同じ源を引くようにした。`data/` に置いたままでは層のimport方向（`utils/` → `data/` は型のみ）に阻まれて取り込み側が値を引けないのが、書き写しの原因だった

型設計の見直しで解消したもの（規約は [コード設計の規約](/code-design) が正）:

- ~~**configの値が `string`**~~: 技能・基本技能・共鳴感情が参照する能力値名・技能グループ名・感情属性名を key union にした。表と表のあいだの参照整合性が型で見られるようになり、下流のキャストも消えた
- ~~**効いていない型引数**~~: `EmokloreSystemDataModel<_Schema>` の型引数はクラス本体で使われておらず、渡していた型の実体も `Record<string, DataField>` で情報が無かった。本体のフィールドクラスがジェネリックでない以上（`@template` を持つのは `ArrayField` だけ）将来効くこともないので、4つの未使用エイリアスごと畳んだ
- ~~**`npc` が到達不能なのに登録されていた**~~: `system.json` の `documentTypes.Actor` に無いので作成できず、それでも `CONFIG.Actor.dataModels` に登録していたため `EmokloreActor#system` の型（`CharacterDataModel`）が嘘になっていた。実装側が `resources?.hp` と防御していたのはそのため。登録と `trackableAttributes.npc`（`NpcDataModel` が持たない `resources` を指していた）を外し、宣言を実態に合わせた
- ~~**キーを確かめずに名乗る**~~: DOMのdatasetから来た文字列を `as SkillKey` と名乗り、その先の分割代入で `TypeError` になりうる形だった。型述語と判別可能union（`SkillRef`）に置き換え、検証を入口1箇所に寄せた
- ~~**キャストの散在**~~: `Object.entries` がキーを `string` に潰すぶんを `typedEntries` に閉じ込め、種別の確認と絞り込みを型述語（`isWeapon`）に統合した。キャストは76 → 58箇所、非nullアサーションは8 → 5箇所になった

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

層どうしのimportの方向（どの層がどこを読んでよいか）は [コード設計の規約](/code-design) が正。上の表は責務と「置かないもの」を決めるもので、矢印までは決めていない。

## 型とモジュールの規約

[コード設計の規約](/code-design)を参照。型の置き場所、`interface` と `type` の使い分け、命名、アサーションの使いどころ、DataModelのスキーマの書き方、見送った厳格フラグの記録はそちらが正。

## スタイルとテンプレートの規約

[UI設計の規約](/ui-design)を参照。CSSの層分け・命名、テンプレートとpartialの扱い、ダイアログの組み方はそちらが正。

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

#### その後: カスタム技能では別の形で決着した

ユーザー定義の技能（[Item `skill`](/data-model#item-skill)）を足したが、**固定35技能の置き換えはしていない**。上の見送り理由は「技能ごとに違うルールを宣言的に持てなくなる」ことであり、それは既存の表を置き換える場合の話だった。別のコレクションを足すだけなら当たらず、既存データも1バイトも動かない。

そのうえで `TypedObjectField` は使っている。ただし**保存先ではなく、効果の着地点として**。本体が Item に `applyActiveEffects` を持たないため、Itemのままでは「〈忍術〉に+1」が届かない。`system.customSkills` を `persisted: false` の動的な表として置き、`prepareBaseData` が所持アイテムから毎回作り直している。

Itemのスキーマは全インスタンス共通なので、見送り理由に挙げた2つの出し分けはカスタム技能でも表現できない。そこは形を変えて引き受けた。

- 能力値の select は `choices` の有無ではなく、`characteristicOptions` の**件数**で出し分ける
- 特化（分野）は**持たないと決めた**ので、出し分けそのものが要らない
