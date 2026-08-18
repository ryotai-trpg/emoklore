# アーキテクチャ

システムの全体構造と、層をまたぐ設計、既知の構造的課題をまとめる。型とモジュールの規約は [コード設計の規約](/code-design)、CSS・テンプレート・ダイアログの規約は [UI設計の規約](/ui-design) が正。

## 全体構造

エントリは `module/emoklore.ts`。`init` フックでDocumentクラス・DataModel・シート・ダイス関連を `CONFIG` に登録する。

ビルドの入口も同じファイル。viteの `lib.entry` がここを指し、出力は `dist/emoklore.mjs` と `dist/emoklore.css`（`system.json` が指す先）。CSSの目次を先頭でimportしているのがCSS出力のトリガで、これを外すと `dist/emoklore.css` が生成されない。

```
module/
  emoklore.ts        … エントリ。CSS目次のimport、CONFIG登録、configのラベル事前ローカライズ、開発用フック
  api.ts             … game.system.api に載せる公開操作。マクロとモジュールの接続面
  config/            … 静的なゲームルール定義（技能・特性・共鳴感情など）→ CONFIG.EMOKLORE
  data/              … TypeDataModelスキーマ（character / npc / kai / weapon / チャットカード）と派生値計算
  rules/             … ゲームルールの純粋関数（判定計算・成功数）。Foundry非依存でvitest対象
  chat/              … チャットカードの組み立てと生成。1カード1ファイル
  documents/         … Actor / Item 拡張とGMへの処理委譲（queries）。判定を実行して結果を流す
  applications/      … ApplicationV2シート・ダイアログ、判定の入口（rolls）、カードのボタンのハンドラ
    context/         … シートがテンプレートに渡すデータの組み立て
  dice/              … カスタムRoll / Die（成功数判定: 1d10≦目標値、1クリティカル / 10ファンブル）
  utils/             … 汎用の道具と、configを翻訳・整形して素材を返すところまで
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
| `chat/` | チャットカードの組み立てと生成（`renderTemplate` / `ChatMessage.create`） | ルール計算、Documentの更新、ダイアログ |
| `documents/` | Documentライフサイクルの薄いオーケストレーション。data層とrules層とchat層をつなぐ | 計算式の実装、ダイアログ |
| `applications/` | シート・ダイアログ・カードのボタンのハンドラ。コンテキスト整形のみ | ルール計算 |
| `dice/` | Roll / Die / 結果の表現。判定の計算自体は `rules/` へ委譲する | ルール計算の実装、シート・ダイアログ |
| `utils/` | 汎用ユーティリティ、i18n機構、configの翻訳・整形、インポータ | ルール計算、HTMLとDocumentの生成 |
| `templates/` | 表示のみ。コンテキストの配列を回して並べる | lookup の組み立て、ルール判断 |
| `css/` | 部品（components）と配置（applications）の2層 | 部品側での位置決め |

**`utils/` と `chat/` の線は「素材か、成果物か」で引く。** `utils/` が返すのは文字列と行データ
まで、`chat/` が返すのはHTMLとChatMessage。技能名の整形（`describeSkillLabel`）はシートも
カードも使うので `utils/`、カードのHTML組み立ては `chat/` になる。

**`dice/` が自分のチャットテンプレートに積むラベルは責務の内。** `EmokloreRoll` の
`resultLabel` などは `_prepareChatRenderContext` に載せるためのもので、「結果の表現」に
含まれる。ここで言う「置かないもの」はシートとダイアログを指す。

層どうしのimportの方向（どの層がどこを読んでよいか）は [コード設計の規約](/code-design) が正。上の表は責務と「置かないもの」を決めるもので、矢印までは決めていない。

## モジュール連携

接続面は2つある。**割り込むためのフック**と、**呼ぶためのAPI**。

### 公開API

`game.system.api`（実体は `module/api.ts`）に、UIを経由せずに呼ぶ意味のある操作だけを並べる。マクロからも同じ口を使う。

| 操作 | 何をするか |
|---|---|
| `applyDamageAndReport(targets, amount, options)` | ダメージを対象へ適用し、結果をチャットに流す。権限が無ければGMへ委譲する |
| `requestSkillCheck()` | DLからの技能判定要求をチャットに出す。内容はダイアログで尋ねる |
| `requestResonanceCheck(preset)` | DLからの共鳴判定要求をチャットに出す |

**内部の関数をここへ足さない。** 並べたぶんだけ外から見える約束が増え、動かせなくなる。本体の `System` は `api` を持たないので、`module/types/emoklore.d.ts` のモジュール拡張で名乗っている。

### 武器カードのフック

戦闘の自動化は他モジュール（midi-qol相当のもの）が引き取れる余地を残したいので、判定とダメージの各段にフックを置いている。

**怪異の攻撃カードは、このうち武器と判定の6つを発火しない**（`preUseWeapon` / `useWeapon` / `preRollAttack` / `rollAttack` / `preRollDamage` / `rollDamage`）。カードの形は武器カードに揃えてあるが、下の `config` は武器専用（`skill` / `damageDie` / `attackPower`）で、怪異はダイス数・判定値・自由式という別の形をしている。同じ名前のフックに別形状の `config` を流すと、`config.damageDie` を読んで書き換えるモジュールの側が壊れる。

**`preApplyDamage` / `applyDamage` の2つは怪異からも発火する。** あれは `EmokloreActor#applyDamage` に置いてあり、ダメージの出どころを問わないため。`pre` が付くものは `Hooks.call` で呼ぶので、`false` を返すとその場で中断する。完了の通知は `Hooks.callAll` なので戻り値を見ない。命名と使い分けはdnd5eの規約に合わせている。

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

カードのボタンは `WeaponCardModel.ACTIONS` の表で `data-action` から引いている。モジュールがここにキーを足せば、テンプレートを差し替えずにボタンを増やせる。**ハンドラの実体は `applications/weapon-card.ts` にあり、`emoklore.ts` の `init` が表へ登録する。** 判定とダメージ適用を駆動するので `data/` には置かない（どのカードも同じ形）。

〈ストレングス〉による近接武器攻撃力の加算は `resolveStrengthBonus` が決め、`buildDamageFormula` の `bonus` に渡る。ダメージの軽減と防具は `EmokloreActor#applyDamage` に寄せてある。〈耐久〉判定も防御判定も防具も「受けるダメージから引く」という同じ形なので、`calculateAppliedDamage` の1つの引き算に流す。カードの「軽減して適用」ダイアログが、防御判定の成功数や手入力の値を `reduction` として流し、防具の既定（装備中防具の合計 `system.armor`）は `applyDamage` の1点が決める。ダイアログで部位条件により防具を外したときだけ、`armor` の上書き値がGM委譲クエリまで運ばれる（`undefined`＝自動と `0`＝防具なしの明示は意味が違うので、途中で `?? 0` に畳まない）。

モジュール連携の接続面はいまここに書いた分だけなので、このページに置く。ハウリングカードやイニシアチブで2つ目のフック群が生えたら、独立した「モジュール連携」ページに出す。

## 自動化の程度

**既定はすべて自動で、設定で切れる。** ルールブックの処理をどこまで肩代わりしてほしいかは卓ごとに分かれるので、止めるつまみを用意している。逆に、新しい自動化を足すつもりはない（[ロードマップ](/roadmap)「実装しないこと: 高度な自動化」）。

判断は1箇所ずつに閉じてある。**設定を読むのはこの表の場所だけ**で、`rules/` は設定を知らない（純粋関数のままにしておく）。

| 設定 | 判断する場所 | 切ると |
|---|---|---|
| `autoArmorReduction` | `EmokloreActor#applyDamage` | 装備中防具の合計が乗らない。ダイアログから明示的に渡した上書き値は効く |
| `autoHpBoundaryNotice` | `chat/damage-applied.ts` の `buildHpEntry` | 結果の行だけが残り、状態付与のボタンが出ない |
| `autoMpBoundaryNotice` | `EmokloreActor#_onUpdate` | 案内カードそのものが出ない |
| `autoSurvivalReminder` | `EmokloreCombat#_onEndRound` | リマインダが出ない |
| `autoResonanceRise` | `applications/requests.ts` の `raiseResonance` | 結果カードは出るが〈∞共鳴〉が動かない |
| `autoEmotionMatch` | `applications/requests.ts` の `resolveRollInput` | 振るたびに共鳴判定ダイアログで尋ねる |
| `skillRollDialog` | `applications/actor-sheet.ts` の `#onRoll` | 素のクリックでも判定オプションを尋ねる（手元の好みなので client スコープ） |
| `damageResultVisibility` | `chat/damage-applied.ts` の `resolveVisibility` | 結果カードをDLだけに、またはチャット欄の選択に従わせる |

**怪異の装甲は `autoArmorReduction` に含めない。** あれは装備ではなく本人が常に持つ平坦な軽減で、HPやMPと同じくアクターの値そのものになる。

**MP境界の案内には `damageResultVisibility` を効かせない。** あれは「敵のHPを伏せる」ための設定で、こちらは自分のシートを編集した結果の案内なので伏せる理由が無い。

公開範囲は本体の `messageMode`（`ChatMessage#_preCreate` が `applyMode` へ渡す）に写している。**渡さなければ `applyMode` 自体が走らない**ので、カードの既定「全員に出す」は何も渡さないことで表している。

**判定はチャット欄のモード選択に従う**（`chat/message.ts` の `currentMessageMode`）。同じ理由で、渡さなければ設定そのものが無視されるため、`createRollMessage` が現在のモードを読んで渡している。`blind` のときは振る側にもダイスを見せない（`evaluate({allowInteractive: false})`。本体の `Roll#toMessage` と同じ扱い）。

追従させるのは「振った人の結果」と、それに対になって**自動で出る**カードだけ。

| 追従する | 理由 |
|---|---|
| 判定結果（`createRollMessage`） | 秘匿判定そのもの |
| 共鳴のあと始末（`chat/resonance-outcome.ts`） | 判定の直後に自動で出るので、ここが公開だと〈∞共鳴〉が動いたことが漏れて秘匿が破れる |

| 追従しない | 理由 |
|---|---|
| 技能要求・共鳴要求のカード | DLがPLに「振って」と頼むもの。届かないと機能しないのに、DL自身には見えているので気づけない |
| 生存リマインダ | ラウンド終了で自動的に出るので、そのとき"たまたま"選ばれていたモードに左右させない |
| 武器・怪異の攻撃カード | 追従させてよいが、判定とは別の判断なので保留 |

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

## イニシアチブとCombatの統合

イニシアチブは本体のCombat / Combatant / CombatTrackerに乗せている。要はエンカウンターごとに「能力値＋技能」を選べることで、ルール上イニシアチブ値は状況で変わる（戦闘は【身体】＋〈スピード〉、捜索は【五感】＋〈観察眼〉…）。

**基準は型付きCombatの `system` に持たせる。** `documentTypes.Combat` に単一種別 `standard` を宣言し、`CombatDataModel` が `characteristic` と `skill` を保存する。`EmokloreCombat#_initializeSource` が `base` を `standard` に寄せるので、種別を選ばせなくても全Combatが基準を持つ。

**Combatantは型付きにしない。** 基準はエンカウンター単位で、同値のタイブレークも手動なので、combatantごとのシステムデータが要らない。ドキュメントクラスだけ差し替える（dnd5eの `Combatant5e` と同じ薄い上書き）。作れない・不要な種別を登録しないのは、Actorの種別と `documentTypes` を必ず揃える方針（下記のNPC・怪異）と同じ判断。

**式は `Combatant#_getInitiativeFormula` の1点で組み立てる。** 本体が「systemが上書きしてよい」と明記する唯一のシームで、roll all / roll NPC / トラッカーの行ロール・再ロールはすべて `Combat#rollInitiative` → `Combatant#getInitiativeRoll` → ここを通る。`combat.system` の基準から式文字列を返し、本体が `actor.getRollData()` に対して解決する。純粋な組み立ては `rules/initiative.ts` に切り出してテストしている。

**既定の【身体】＋〈スピード〉だけは派生値 `@initiative` を返す。** `system.initiative` は効果の着地点でもあるので、既定の基準では初速への効果が抜け落ちない。他の基準は入力（能力値・技能）側の効果だけが乗り、`system.initiative` への直接の効果は乗らない。これは既知の割り切りで、基準ごとに別の初速修正を持ち込むルールが無いぶん許容している。

**ターン順は線形。** イニシアチブ降順の素直な並びで、draw-steelのようなスロット制ではない。同値のタイブレーク（1D10の小さい方が先）と待機・放棄は、本体トラッカーの相対入力（`+2` / `=5`）による手動調整に委ねる。非線形な並べ替えでターンイベントが欠ける本体の挙動（`#triggerTurnEvents` が前進を仮定する）は、線形運用なので踏まない。`_manageTurnEvents` の再実装はしない。

**トラッカーのUIは `_onRender` で後付け注入する。** 基準の選択バーを冪等に差す。注入コードは層分けに従い `applications/`（`EmokloreCombatTracker`）に置く。ryuutamaは `combat.system._onRender` へ転送してDataModel側にUIを置くが、`data/` にUIを持たせない方針なので、こちらはトラッカー側に置く。

**ラウンド終了時の〈＊生存〉判定リマインダは `Combat#_onEndRound` で出す。** 【心肺停止】のcombatantを集めて型付きChatMessage（`SurvivalReminderModel`）を作る。表示と判定ショートカットまでで、判定の強制や【死亡】の自動付与はしない（HP/MP境界の案内と同じ方針）。

## 既知の構造的課題

1. **スキーマ定義が `CONFIG.EMOKLORE` に依存**: `module/data/character.ts` がキー集合を得るために定義時点で `CONFIG.EMOKLORE` を読む。`CONFIG.EMOKLORE` を設定するのは自分の `init` フックなので制御下にあるが、他モジュールが `init` 中に `Actor.dataModels.character.schema` へ触ると壊れうる。`TypedObjectField` での解消は検討したうえで見送った（下記）
2. **Actorの種別とunion**: `character`（共鳴者）・`npc`（人間NPC）・`kai`（怪異）の3種別を登録しているので、`EmokloreActor#system` は3つのunion。共通して持つ `resources.hp/mp` に触るリソース操作（`applyDamage`・MP境界）は絞り込みなしで通り、共鳴値・技能判定のように一部の種別しか持たないものは型述語（`isCharacter` / `isCharacterLike` / `isKai`、`EmokloreItem#isWeapon` と同じ形）で絞る。人間NPCは能力値・技能・派生値・技能判定を共鳴者と共有する（両者が `CharacterLikeDataModel` を継承。ルール上「人間NPCに専用ルールは無く、判定が要るなら共鳴者と同じ作り」）。怪異は能力値の標準ブロックを持たない別形状で、直接判定（ダイス数＋判定値）の攻撃を持つ。怪異の攻撃カードのボタンハンドラは `applications/`（`kai-attack-card.ts` と `attack-card.ts`）に置き `ACTIONS` へ外部登録する（どのカードも同じ形）。**種別は `system.json` の `documentTypes` と `CONFIG.Actor.dataModels` で必ず揃える**（作成できない種別を登録すると `system` の型が嘘になる）
3. **`config/` の副作用**: `module/config/index.ts` が import 時に `preLocalize` を呼び、`performPreLocalization` が `CONFIG.EMOKLORE` を破壊的に書き換える。この表の「`config/` に置かないもの」に反するが、dnd5e / draw-steel 由来の確立したパターンなので当面は踏襲する
4. **取り込みのパーサが `CONFIG.EMOKLORE` を読む**: `utils/charsheet-importer.ts` の `buildImportIndexes()` が表示名からキーへの逆引き索引を `CONFIG.EMOKLORE` から作る。解析関数そのもの（`parseSkills` / `parseEmotions`）は索引を引数で受けるので単体テストできるが、索引を作るところは Foundry の起動を要る。完全に純粋化するなら索引を呼び出し側から渡す形になり、変更が呼び出し側まで広がる（Issue #58）
5. **型チェックが飛びうる**: secretsはフォークからのPRとDependabotのPRに渡らないので、Actions cacheがミスすると本体ソースの調達手段が無くなり、型チェックを飛ばして緑になる。cacheの復元自体はフォークPRからでもできる（できないのは新規cacheの保存のほう）ため週2回のscheduleで延命しており、飛ばしたときは警告を出し、手元の `pre-push` が受け皿になっている。**穴が完全に塞がるわけではない**（本体ソースを持たない人が、cacheの切れた時期に出したPRは、型チェックを一度も通さないまま緑になる）

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
