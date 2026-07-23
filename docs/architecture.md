# アーキテクチャ

システムの全体構造と、層をまたぐ設計、既知の構造的課題をまとめる。型とモジュールの規約は [コード設計の規約](/code-design)、CSS・テンプレート・ダイアログの規約は [UI設計の規約](/ui-design) が正。

## 全体構造

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

## 層の責務

dnd5e の module 構成（applications / data / dice / documents / config / utils）を手本に、責務は次のとおり分担する。

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

**攻撃判定の `config` に `base`（基本技能かどうか）は載せていない。** これは `skill` から一意に決まる値なので、両方を載せると「通常技能のキーに `base: true`」のような矛盾した対をフックの側から作れてしまう。`base` をフックの**前**に算出するのも同じ理由で駄目で、`skill` だけを差し替えられると差し替え前の `base` と組み合わされて技能値が拾えなくなる。だからフックの**後**に `resolveAttackSkill()` から引き直す。

カードのボタンは `WeaponCardModel.ACTIONS` の表で `data-action` から引いている。モジュールがここにキーを足せば、テンプレートを差し替えずにボタンを増やせる。

〈ストレングス〉による近接武器攻撃力の加算は `resolveStrengthBonus` が決め、`buildDamageFormula` の `bonus` に渡る。ダメージの軽減と防具は `EmokloreActor#applyDamage` に寄せてある。〈耐久〉判定も防御判定も防具も「受けるダメージから引く」という同じ形なので、`calculateAppliedDamage` の1つの引き算に流す。カードの「軽減して適用」ダイアログが、防御判定の成功数や手入力の値を `reduction` として流し、防具の既定（装備中防具の合計 `system.armor`）は `applyDamage` の1点が決める。ダイアログで部位条件により防具を外したときだけ、`armor` の上書き値がGM委譲クエリまで運ばれる（`undefined`＝自動と `0`＝防具なしの明示は意味が違うので、途中で `?? 0` に畳まない）。

モジュール連携の接続面はいまこのフック群だけなので、このページに置く。ハウリングカードやイニシアチブで2つ目のフック群が生えたら、独立した「モジュール連携」ページに出す。

## 効果（ActiveEffect）の載せ方

本体の ActiveEffect は**適用が2フェーズある**（`change.phase` の `initial` / `final`）。設計に効いているのはこれ。

`prepareData()` は `prepareBaseData` → `prepareEmbeddedDocuments`（ここで `applyActiveEffects("initial")`）→ `prepareDerivedData` → `applyActiveEffects("final")` の順に進む（`client/documents/actor.mjs` の `:431` と `:468`）。つまり **`final` は派生値の計算が終わったあとに走る**。

この2つを次のように使い分けている。

- **`initial`** — 通常。`mod.*` と、能力値・技能レベルのような素の値。ここに乗せたものは `prepareDerivedData` の入力になるので、HP最大値や目標値まで連動する
- **`final`** — 派生値そのものを動かしたいときだけ。`initiative` や `hp.max` は `prepareDerivedData` が毎回入れ直すので、`initial` に乗せても消える

**判定の修正は `mod.*` に寄せる。** 目標値を `final` で直接書いても結果は同じだが、`resolveSkillRoll` を通らないぶんチャットの式に内訳（`(5-2)DM≦`）が出ない。修正は4系統（全体・能力値・技能グループ・技能）を合算する形になっている。

### 保存しないフィールド

`mod.*` と `hp.max` / `mp.max` / `initiative` は `persisted: false` にしてある。前者は効果の着地点としてしか使わず、後者は `prepareDerivedData` が毎回入れ直すので、どちらも保存する意味が無い。

**スキーマには残す。** これが要点で、スキーマにあるフィールドへの効果は `DataField#applyChange` を通り、効果値の Roll 評価（`"@skills.strength.level"` が書ける）と `clean`/`validate`（範囲外は端に丸められる）が効く。スキーマに無いキーは本体が値の型を推測する経路に落ち、どちらも効かない。`initiative` はこのためにスキーマのフィールドとして持つ（`declare` だけの派生値では効果の経路に乗らない）。

dnd5e は同じ用途に `persisted: false` を使っている（旧来の「スキーマ外キーを特別扱いする」方式は 6.0 で非推奨になった）。ただし順序問題の解き方は違っていて、あちらは `FormulaField` に `@` を文字列のまま持たせて評価を後段へ遅らせており、`phase` は使っていない。エモクロアはダイス項を含むボーナスがルールに無く、ダイスボーナスは「振る個数」＝整数なので、式文字列のフィールドは持ち込んでいない。

### 属性キーの選択

`EmokloreActiveEffectConfig` が本体の設定シートの変更行だけを差し替え、属性キーを「対象 × 修正先」の2つの選択から組み立てる。合成と読み取りは `utils/effect-keys.ts` の純粋関数で、`CONFIG` を読まないので単体テストできる。

**読み取れないキーは生の入力に倒す。** `system.initiative` のように選択肢に無いキーも効果としては有効なので、塞ぐと編集できなくなる。

あわせて `phase` を選べるようにしている。本体のシートは `phase` を hidden でしか持たないので、これが無いと `final` を選ぶ手段自体が無い。

`CONFIG.ActiveEffect.changeTypes`（独自の適用種別の登録）は使っていない。「対象 × 修正先」で表せない修正が出てきたら検討する。いまは本体の追加／上書きで足りている。

## GMへの委譲（クエリ）

Foundryは `Document#update` をサーバ側で権限検査するので、OWNER権限を持たないアクター（多くの場合、敵）はプレイヤーのクライアントからは書き換えられない。ダメージ適用はこれに当たるため、権限を持つGMのクライアントに肩代わりしてもらう。

**生の `game.socket` ではなく本体のクエリ機構を使う**。`CONFIG.queries` にシステムIDで受け口を登録し、送る側は `User#query` を呼ぶ。draw-steel の `DrawSteelSocketHandler` と同じ形。

生ソケットに対する利点は3つ。応答が戻るので結果の組み立てを1箇所にまとめられること、タイムアウトとエラー伝播を本体が持つこと、宛先が1人に決まるので「自分が処理すべきか」の判定が要らないこと。`system.json` の `"socket": true` も不要になる（クエリは core の `userQuery` イベントを通り、`system.<id>` の名前空間を使わない）。

クエリ名は他パッケージと衝突しないようシステムIDを接頭辞にする（接頭辞なしの名前は本体の予約）。`QUERY_USER` 権限は既定でプレイヤーにも与えられている（`common/constants.mjs` の `defaultRole: USER_ROLES.PLAYER`）。

宛先は `game.users.activeGM`。この getter は全クライアントで同じ1人を返すので、GMが複数いても二重に適用されない。自分がその指名GMなら委譲せずその場で処理する。

やり取りするのは**トークンのアクターのUUID**。非リンクトークンの合成アクターは `Scene.<id>.Token.<id>.Actor.<id>` という形のUUIDを持ち、`fromUuid` でそのトークン専用のアクターに解決される。ワールドのアクターのUUIDを送ると、同じ元データから置いた雑魚が全員まとめて減る。

非リンクトークンでも権限は変わらない。合成アクターは元のアクターの `ownership` をそのまま引き継ぐので、プレイヤーから見て敵は依然として書き換えられない。トークン経由にしても委譲は要る。

1体でも触れない対象が混じっていれば、触れるものも含めてまとめてGMに預ける。一部だけ自分で処理すると適用の記録が2件に割れてしまうため。

## 既知の構造的課題

1. **スキーマ定義が `CONFIG.EMOKLORE` に依存**: `module/data/character.ts` がキー集合を得るために定義時点で `CONFIG.EMOKLORE` を読む。`CONFIG.EMOKLORE` を設定するのは自分の `init` フックなので制御下にあるが、他モジュールが `init` 中に `Actor.dataModels.character.schema` へ触ると壊れうる。`TypedObjectField` での解消は検討したうえで見送った（下記）
2. **NPCの扱いが未定**: `NpcDataModel` は `wickedness` しか持たず、シートも判定もなく、登録もしていない — 作成できない種別を登録すると `EmokloreActor#system` の型が嘘になるため（`module/data/npc.ts` は意図的に残してある）。NPC用シートの実装（[ロードマップ](/roadmap) Phase 3）で判定まわりごと決める。登録を戻すと `system` が union になるので、NPCで壊れる箇所は型チェックが教えてくれる
3. **`config/` の副作用**: `module/config/index.ts` が import 時に `preLocalize` を呼び、`performPreLocalization` が `CONFIG.EMOKLORE` を破壊的に書き換える。この表の「`config/` に置かないもの」に反するが、dnd5e / draw-steel 由来の確立したパターンなので当面は踏襲する
4. **`utils/charsheet-importer.ts` が2つの顔を持つ**: 純粋なパーサ（`parseSkills` / `parseEmotions` / `validateCharSheetJSON`、単体テスト済み）と、`actor.update()` と `ui.notifications` を持つ適用部（`importFromCharSheet`）が同じファイルにある。後者は `EmokloreActor` を `import type` で借りているので、**この逆依存はimportグラフに現れない**。分割は20〜30行規模だが、`buildImportIndexes()` が `CONFIG.EMOKLORE` を読むため、パーサを完全に純粋化するなら索引を引数で渡す形への変更が要る（Issue #58）
5. **`data/messages/weapon-card.ts` がオーケストレータ**: カードのボタンハンドラ（`rollAttack` / `rollDamage` / `applyDamage`）が `actor.buildSkillRoll()` と `applyDamageToTargets()` を駆動し、`ui.notifications` とフックも持つ。`data/` の「置かないもの: UI、チャット生成」に反する。層表の `data/` の行に `documents/` を足して解決してはいけない（表が `documents/` → `data/` を許しているので、相互依存を許可することになる）。直すならハンドラの置き場所のほう
6. **CIの穴**: 型チェックジョブはフォークからのPRで実行されない。理由は本体ソースの調達手段が無くなることで、secretsがフォークPRに渡らないため、キャッシュミス時のフォールバックである `tools/fetch-foundry.mjs` が成立しない。**Actions cache そのものはフォークPRからでもbase/デフォルトブランチのぶんをrestoreできる**（できないのは新規cacheの保存のほう）ので、ミスしなければ動きうるが、ミスしたときに落ちるだけのジョブは置いていない。lefthookには型チェックもテストも入っていない（`pre-push` 自体が無い）ので、**フォークからのPRは型チェックを一度も通さずに緑になれる**（Issue #56）

## 検討して見送ったもの

### `TypedObjectField` によるスキーマの静的化

`CONFIG.EMOKLORE` への定義時依存（課題1）を消す手段になるが、**採らない**。

本体ソース（`common/data/fields.mjs`）で確認できる性質:

- キーを自動生成しない。新規アクターの `skills` は `{}` から始まる
- `element` は全キー共通。技能ごとに `initial` / `choices` / フィールドの有無を変えられない

見送りの理由は2つ目にある。現在のスキーマは技能ごとのルールを宣言的に持っており、シートがそれを直接読んで描画している。

- `skill.field.fields.characteristic.choices` の有無で、能力値の select と静的表示を出し分けている
- `skill.field.fields.specialization` の有無で、専門分野の入力欄を出し分けている

`TypedObjectField` にするとこれらは表現できず、ルールが config 参照＋実行時コードへ散る。得られるのは定義時依存の解消だけで、その依存が起こす事故は起きておらず、`CONFIG.EMOKLORE` を設定するのは自分の `init` フックで制御下にある。

再検討する価値があるのは、固定35技能の表自体を**ユーザーが追加・削除できるようにする**場合。そのときは固定キーのスキーマが成立しなくなるため、前提が変わる。

ユーザー定義のカスタム技能（[Item `skill`](/data-model#item-skill)）はこの見送りに当たらない。固定35技能とは別のコレクションを足すだけで、技能ごとの出し分けの前提を壊さない。そこでは `TypedObjectField` を**保存先ではなく効果の着地点として**使っている — 本体は Item に `applyActiveEffects` を持たないため、`system.customSkills` を `persisted: false` の動的な表として置き、`prepareBaseData` が所持アイテムから毎回作り直すことで「〈忍術〉に+1」を届けている。Itemのスキーマは全インスタンス共通なので上の2つの出し分けは表現できず、能力値の select は `characteristicOptions` の**件数**で出し分け、特化（分野）は持たないと決めている。
