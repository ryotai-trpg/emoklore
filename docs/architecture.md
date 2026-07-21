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
  documents/         … Actor / Item 拡張。判定の入力を集めて結果を流すオーケストレーション
  applications/      … ApplicationV2シート・ダイアログ（HandlebarsApplicationMixin + Play/Editモードmixin）
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

`config` はその場で組み立てた設定オブジェクトをそのまま渡しているので、フックの中で書き換えれば判定内容を差し替えられる。攻撃判定なら `skill` と `base`、ダメージなら `successCount` / `damageDie` / `attackPower` / `bonus`。`preApplyDamage` の `updates` も同じく、そのまま `Actor#update` に渡る更新データなので書き換えが効く。

カードのボタンは `WeaponCardModel.ACTIONS` の表で `data-action` から引いている。モジュールがここにキーを足せば、テンプレートを差し替えずにボタンを増やせる。

〈ストレングス〉による近接武器攻撃力の加算はまだ配線していないが、`buildDamageFormula` の `bonus` が接続点になる。ダメージの軽減も `EmokloreActor#applyDamage` の `reduction` に寄せてある。〈耐久〉判定も防御判定も「受けるダメージを【成功数】点軽減する」という同じ形で、防具を入れるならそれも同じ引き算になるため、口を1つにしておく。

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
4. **`documents/` から `applications/` への逆依存**: `module/documents/actor.ts` が `promptResonanceRoll` をimportし、`rollResonance` の中で呼んでいる。「引数が無ければUIを開く」という判断はプレゼンテーションの決定なので、下の表の「`documents/` に置かないもの: ダイアログ」に反する。シート側で入力を解決してから渡す形にすれば矢印が反転する
5. **`utils/` が雑多**: 純粋なパーサ（`charsheet-importer`）、i18n機構（`localization`）、チャットI/O（`chat`）、DOM・Documentのアダプタ（`sheet` `targets` `queries`）が同居している。特に `queries.ts` は `actor.applyDamage()` を呼ぶオーケストレータで、ユーティリティではない。**この逆依存は `import type` のせいでimportグラフに現れない**
6. **攻撃技能の引き方が3箇所で食い違う**: 未知の技能キーに対し `data/item-models.ts` は `attackSkills.fight`（近接・d3）に倒れるが、`data/messages/weapon-card.ts` は `base: false` / `damageDie: null`（遠隔相当）になる。同じ入力に別の答えを返す。`resolveAttackSkill()` に寄せれば重複と食い違いが同時に消える
7. **同じ定数を2箇所で宣言**: 技能レベルの範囲は `data/character.ts` の `SKILL_LEVEL_MIN` / `SKILL_LEVEL_MAX` が正のはずだが、`utils/charsheet-importer.ts` がローカルに同じ値を持っている。シート側は正しくimportしている
8. **CIの穴**: 型チェックジョブはフォークからのPRで実行されない（Actions cacheがフォークから復元できるため）。lefthookにも型チェックは入っていないので、**フォークからのPRは型チェックを一度も通さずに緑になれる**（Issue #7 の範囲）

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
