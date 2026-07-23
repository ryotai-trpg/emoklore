# データモデル

アクター・アイテム・チャットメッセージが保存する値の一覧。スキーマの正は `module/data/` のコードで、このページはその読み方を説明するもの。**キーと日本語名の対応は `npm run check:schema-doc` が `module/config/` と突き合わせている**ので、綴りがずれたままになることはない。

ActiveEffectでどのキーを変更できるかは [効果（ActiveEffect）](/active-effect) にある。

## 登録されている種別

| ドキュメント | 種別 | データモデル |
|---|---|---|
| Actor | `character` | `CharacterDataModel` |
| Item | `weapon` | `WeaponDataModel` |
| Item | `armor` | `ArmorDataModel` |
| Item | `skill` | `SkillDataModel` |
| ChatMessage | `weapon` | `WeaponCardModel` |
| ChatMessage | `damageApplied` | `DamageAppliedModel` |

**種別は `system.json` の `documentTypes` と `CONFIG.*.dataModels` の両方に書く。** 片方だけでは噛み合わない。`documentTypes` に無い種別を `dataModels` に登録すると、作成できないのに `system` の型だけが増えて嘘になる（警告も出ない）。

`npc` は `module/data/npc.ts` に定義だけが残っている。**登録していないので作成できない。** `EmokloreActor#system` を `CharacterDataModel` 固定で宣言しているため、登録すると型が嘘になる。NPCシートを作るときに合わせて決める（[ロードマップ](/roadmap) Phase 3）。

## マイグレーション機構は無い

`migrateData` / `shimData` / `LenientSchemaField` のいずれも実装しておらず、保存データにバージョンを刻んでもいない。つまり**configのキーを改名すると、古いデータは行き場を失ってそのまま残る**。

キーを変えるときは値を移す仕組みを自分で書く必要がある。日本語の表示名を変えるだけなら `lang/ja.json` を直せばよく、キーは触らなくてよい。

## Actor `character`

### `system.resources`

| パス | 型 | 既定 | 意味 |
|---|---|---|---|
| `resources.hp.value` | NumberField | 11 | 現在HP |
| `resources.hp.max` | NumberField | 11 | 最大HP。**保存しない**（下の導出値を参照） |
| `resources.mp.value` | NumberField | 2 | 現在MP |
| `resources.mp.max` | NumberField | 2 | 最大MP。**保存しない** |
| `resources.resonance.value` | NumberField | 1 | 共鳴値。1未満にはならない |
| `resources.resonance.max` | NumberField | 9 | 共鳴値の上限。こちらは計算しないので手で決める |

`hp.max` と `mp.max` は `persisted: false` を付けてある。`prepareDerivedData` が能力値から計算し直すので、書いても次の準備で捨てられる値だった。スキーマには残っているので[効果](/active-effect)の適用先にはでき、`phase: "final"` なら上書きが残る。

**保存しないだけで、読むぶんには普通のフィールド**。シートもトークンバーも `system.resources.hp.max` をそのまま読む。

### `system.mod`

判定すべてに効く修正。`mod` の3つ（`bonus` / `success` / `target`）だけを持ち、シートには出ない。

ルールブックの極限共鳴（ハウリング）には「全ての技能は判定値-2される」のように、能力値でも技能でも技能グループでも切り分けられない修正が繰り返し出てくる。それを受ける場所がこれ。他の `mod` と同じく `persisted: false`。

### `system.characteristics.<能力値>`

| パス | 型 | 制約 | 意味 |
|---|---|---|---|
| `characteristics.<k>.value` | NumberField | 1〜6、既定1 | 能力値 |
| `characteristics.<k>.mod.bonus` | NumberField | 既定0 | ダイス数への修正 |
| `characteristics.<k>.mod.success` | NumberField | 既定0 | 成功数への修正 |
| `characteristics.<k>.mod.target` | NumberField | 既定0 | 目標値への修正 |

`mod` の3つはシートから編集できない。ActiveEffectの適用先として存在している。この組は全体・能力値・技能・基本技能・技能グループの5箇所に出てくるので `modifierField()` にまとめてある。

**`mod` は保存しない**（`persisted: false`）。効果の着地点としてしか使わないので、保存すると全部0のフィールドがアクター1体につき64組×3値ぶん並ぶだけになる。スキーマには残るので効果は本来の経路で乗り、効果値のRoll評価も整数の検証も効く。

キーは8種:

| キー | 名前 |
|---|---|
| `physical` | 身体 |
| `dexterity` | 器用 |
| `mentality` | 精神 |
| `sensitivity` | 五感 |
| `intelligence` | 知力 |
| `charisma` | 魅力 |
| `sociality` | 社会 |
| `fortune` | 運勢 |

### `system.skills.<技能>`

| パス | 型 | 制約 | 意味 |
|---|---|---|---|
| `skills.<k>.level` | NumberField | 0〜3、既定0 | 技能レベル。そのままダイス数になる |
| `skills.<k>.characteristic` | StringField | 既定は定義の能力値 | 判定に使う能力値。**選べる技能にだけ `choices` が付く** |
| `skills.<k>.specialization` | StringField | 既定 `""` | 特化。**特化を持つ技能にしかフィールドが無い** |
| `skills.<k>.mod.*` | NumberField | 既定0 | 能力値と同じ3つ |

`label` / `group` / `isExtra` は保存しない。`CONFIG.EMOKLORE` から引けるので、保存すると二重管理になるうえ、言語を切り替えたときに古い表示名が残る。

`characteristic` の `choices` に入るのは翻訳済みの文字列ではなく**i18nキー**。描画時にテンプレートが `formInput` へ `localize=true` を渡して本体に解決させる。スキーマ定義の時点で `game.i18n` を呼ぶと、`i18nInit` より先に走ったときに壊れる。

技能は35種。`★` は特殊技能（`isExtra`）、`特` は特化を持つもの。能力値が複数あるものは選択式。

| キー | 名前 | 能力値 | グループ | |
|---|---|---|---|---|
| `search` | 検索 | 知力 | 調査系 | |
| `insight` | 洞察 | 知力 | 調査系 | |
| `mapping` | マッピング | 器用／五感 | 調査系 | |
| `instinct` | 直感 | 精神 | 調査系 | |
| `appraisal` | 鑑定 | 五感 | 調査系 | |
| `keenObservation` | 観察眼 | 五感 | 知覚系 | |
| `listen` | 聞き耳 | 五感 | 知覚系 | |
| `taste` | 毒見 | 五感 | 知覚系 | |
| `threatDetection` | 危機察知 | 五感／運勢 | 知覚系 | |
| `spiritualSense` | 霊感 | 精神／運勢 | 知覚系 | ★ |
| `etiquette` | 社交術 | 社会 | 交渉系 | |
| `debate` | ディベート | 知力 | 交渉系 | |
| `charm` | 魅了 | 魅力 | 交渉系 | |
| `psychology` | 心理 | 精神／知力 | 交渉系 | |
| `specializedKnowledge` | 専門知識 | 知力 | 情報系 | 特 |
| `insider` | 事情通 | 五感／社会 | 情報系 | |
| `industryKnowledge` | 業界 | 社会／魅力 | 情報系 | 特 |
| `speed` | スピード | 身体 | 運動系 | |
| `strength` | ストレングス | 身体 | 運動系 | |
| `acrobatics` | アクロバット | 身体／器用 | 運動系 | |
| `dive` | ダイブ | 身体 | 運動系 | |
| `martialArt` | 武術 | 身体 | 運動系 | 特 |
| `secretTechnique` | 奥義 | 身体／精神／器用 | 運動系 | ★特 |
| `rangedAttack` | 射撃 | 器用／五感 | 運動系 | ★特 |
| `endurance` | 耐久 | 身体 | 生存系 | |
| `grit` | 根性 | 精神 | 生存系 | |
| `medicine` | 医術 | 器用／知力 | 生存系 | |
| `resurrection` | 蘇生 | 知力／精神 | 生存系 | ★ |
| `technique` | 技巧 | 器用 | 特殊 | 特 |
| `art` | 芸術 | 器用／精神／五感 | 特殊 | 特 |
| `pilot` | 操縦 | 器用／五感／知力 | 特殊 | 特 |
| `cipher` | 暗号 | 知力 | 特殊 | |
| `computer` | 電脳 | 知力 | 特殊 | |
| `stealth` | 隠匿 | 器用／社会／運勢 | 特殊 | |
| `strongLuck` | 強運 | 運勢 | 特殊 | ★ |

### `system.baseSkills.<基本技能>`

| パス | 型 | 制約 | 意味 |
|---|---|---|---|
| `baseSkills.<k>.level` | NumberField | **1に固定**（min=max=1） | 基本技能はレベルを持たない |
| `baseSkills.<k>.characteristic` | StringField | 定義の能力値 | `choices` は無く、選べない |
| `baseSkills.<k>.mod.*` | NumberField | 既定0 | 能力値と同じ3つ |

シートでは読むだけで編集できない。キーは13種:

| キー | 名前 | 能力値 | グループ |
|---|---|---|---|
| `investigation` | 調査 | 器用 | 調査系 |
| `perception` | 知覚 | 五感 | 知覚系 |
| `negotiations` | 交渉 | 魅力 | 交渉系 |
| `knowledge` | 知識 | 知力 | 情報系 |
| `news` | ニュース | 社会 | 情報系 |
| `athletic` | 運動 | 身体 | 運動系 |
| `fight` | 格闘 | 身体 | 運動系 |
| `throw` | 投擲 | 器用 | 運動系 |
| `survival` | 生存 | 身体 | 生存系 |
| `self` | 自我 | 精神 | 生存系 |
| `treatment` | 手当て | 知力 | 生存系 |
| `handiwork` | 細工 | 器用 | 特殊 |
| `luck` | 幸運 | 運勢 | 特殊 |

### `system.customSkills.<アイテムid>`

カスタム技能（Item `skill`）を判定に繋ぐための表。**保存しない**（`persisted: false`）。

正はアイテム側で、ここは `prepareBaseData` が所持している skill アイテムから毎回作り直す。写しているのは、**本体が Item に `applyActiveEffects` を持たない**ため（`client/documents/actor.mjs` にしかない）。効果は `actor.system.*` にしか着地できないので、「〈忍術〉の判定に+1」を組込技能と同じように書くには受け皿がアクター側に要る。既存の `mod` が効果の着地点でしかないのと同じ考え方。

`TypedObjectField` なのでキーを実行時に増やせる。本体の `getFieldForProperty` は `_source` を添えて解決するため、保存しないこの表でも効果は DataField 経由で乗る（Roll評価も整数の検証も効く）。

| パス | 型 | 制約 | 意味 |
|---|---|---|---|
| `customSkills.<id>.level` | NumberField | 0〜3 | 判定に使うレベル。**ベース区分は常に1** |
| `customSkills.<id>.characteristic` | StringField | | 判定に使う能力値 |
| `customSkills.<id>.mod.*` | NumberField | 既定0 | 能力値と同じ3つ |

`label` / `isBase` / `isExtra` / `group` / `characteristicOptions` / `target` もアイテムから写して載せているが、**スキーマには無い**（効果の対象にはできない）。

キーがアイテムのidなので、**技能を消して作り直すと、その技能を指していた効果は宙に浮く**。

### `system.skillGroups.<グループ>`

`mod` の3つだけを持つ。シートには出ず、ActiveEffectで「調査系すべてに+1」のようにまとめて修正するために存在する。

| キー | 名前 |
|---|---|
| `investigation` | 調査系 |
| `perception` | 知覚系 |
| `negotiations` | 交渉系 |
| `knowledge` | 情報系 |
| `athletic` | 運動系 |
| `survival` | 生存系 |
| `unique` | 特殊 |

グループは基本技能と同じ綴りのキーを使うが別のテーブルなので、表示名は「調査」と「調査系」のように異なる。

### `system.emotions`

`surface`（表）・`hidden`（裏）・`root`（ルーツ）の3つ。素の StringField だが、**入るのは共鳴感情のキー**（47種）で自由記述ではない。`choices` を付けていないのでスキーマは何も強制しないが、取り込みは対応表に無いラベルを保存しない。生の文字列を入れるとシートが未解決のi18nキーを表示する。

感情属性は5種:

| キー | 名前 |
|---|---|
| `desire` | 欲望 |
| `passion` | 情念 |
| `ideal` | 理想 |
| `relationship` | 関係 |
| `wound` | 傷 |

### `system.biography`

`age` / `gender` / `occupation` / `hometown` / `appearance` / `personality` / `background` / `importantPeople` / `likesAndDislikes` はいずれも素の StringField。`note` だけ HTMLField で、`system.json` の `htmlFields` に `biography.note` として宣言し、描画前に `enrichHTML` を通している。

### 導出値（保存しない）

計算は `module/rules/derived-values.ts` にあり、`prepareDerivedData` は配線だけを持つ。

| 値 | 計算 |
|---|---|
| `skills.<k>.target` | 技能レベル ＋ 対応する能力値 |
| `baseSkills.<k>.target` | 対応する能力値（`treatment` だけ半分・切り上げ） |
| `resources.hp.max` | 10 ＋ 身体 |
| `resources.mp.max` | 精神 ＋ 知力 |
| `resources.resonance.value` | 1未満なら1に上げる |
| `initiative` | 身体 ＋ スピードのレベル |
| `armor` | 装備中防具の防御力合計（`rules/armor.ts` の `calculateArmorTotal`） |

`hp.value` / `mp.value` は `max` を超えないよう毎回丸める。

導出値のうち `resources.hp.max` / `resources.mp.max` / `initiative` / `armor` は**スキーマにフィールドがあり、保存だけしない**（`persisted: false`）。かつて `initiative` はスキーマに無く `declare` だけで足していたが、それだと効果を当てたとき本体が値の型を推測する経路に落ち、効果値のRoll評価も整数の検証も効かなかった。

`skills.<k>.target` と `baseSkills.<k>.target` はいまもスキーマに無く `declare` だけ。効果を当てること自体はできるが、上の3つと違って検証を伴わない。

## Item `weapon`

| パス | 型 | 制約 | 意味 |
|---|---|---|---|
| `skill` | StringField | `choices` は攻撃技能5種、既定 `fight` | 参照技能 |
| `attackPower` | StringField | 既定 `""` | 武器攻撃力。**数値ではなく式** |
| `range` | StringField | 既定 `""` | 射程。自由記述で、近接武器では使わない |
| `equipped` | BooleanField | 既定 `false` | 構えているかの記録。ルール処理には繋がらない |
| `notes` | HTMLField | | 備考。`htmlFields` に宣言済み |

`attackPower` が文字列なのは、ルールブックが 肉体(1)・棒(2) と ナイフ(1D3)・拳銃(2D6) を同じ「武器攻撃力」として並べているため。`Roll.validate()` を通す独自バリデータが付いていて、式として読めない値は保存できない。

派生値（`prepareDerivedData` が攻撃技能の定義から引く）:

| 値 | 意味 |
|---|---|
| `rangeType` | `melee`（近接）か `ranged`（遠隔） |
| `damageDie` | ダメージダイス。`d3` / `d6` / なし |
| `usesBaseSkill` | 基本技能を参照するか |

攻撃技能は5種:

| キー | 名前 | 間合い | ダメージダイス | 基本技能 |
|---|---|---|---|---|
| `fight` | 格闘 | 近接 | d3 | 使う |
| `martialArt` | 武術 | 近接 | d3 | 使わない |
| `secretTechnique` | 奥義 | 近接 | d6 | 使わない |
| `throw` | 投擲 | 遠隔 | なし | 使う |
| `rangedAttack` | 射撃 | 遠隔 | なし | 使わない |

## Item `armor`

防具。書籍版ルールブックの「防御力（受けるダメージから引く固定値）＋適用部位の条件」を受ける器。**書籍固有のアイテムデータは同梱しない**（値は書籍を持つユーザーが書く）。公式シナリオの敵の「装甲」も、防具アイテムを1つ持たせる形で扱える。

| パス | 型 | 制約 | 意味 |
|---|---|---|---|
| `defense` | NumberField | 0以上の整数、既定 `0` | 防御力。装備中ならダメージ適用で自動で引かれる |
| `coverage` | StringField | 既定 `""` | 部位・適用条件。「頭部のみ」のような自由記述 |
| `equipped` | BooleanField | 既定 `true` | 装備中か。装備中の防具だけが軽減に数えられる |
| `notes` | HTMLField | | 備考。`htmlFields` に宣言済み |

`equipped` の既定が武器と違って `true` なのは、防具は「着ている」が常態で、敵に防具を1つ作ればそのまま装甲として働くようにするため。部位に当たったかの判断はDL裁量で、適用しない防具はダメージ適用のダイアログでチェックを外す（機構は持たない）。

## Item `skill`

カスタム技能。ルールブックが技能一覧のページで認めている「シナリオや舞台設定などに合わせたオリジナルの技能」を置く器で、組込の35技能＋13基本技能とは別に、キャラクターごとに持つ。

Itemにしてあるのは、コンペンディウムに入れて配ったり他のキャラクターへドラッグで渡したりを本体任せにできるため。**システムはコンペンディウムを同梱していない**が、ワールド内に自分で作れば配布も受け渡しも動く（`ActorSheetV2#_onDropItem` が処理する）。

| パス | 型 | 制約 | 意味 |
|---|---|---|---|
| `category` | StringField | `base` / `normal` / `extra`、既定 `normal` | 区分 |
| `characteristicOptions` | SetField(StringField) | 能力値8種、1件以上 | 取りうる参照能力値 |
| `characteristic` | StringField | 能力値8種 | 判定に使う能力値 |
| `group` | StringField | 技能グループ7種、空可 | 所属する技能グループ |
| `level` | NumberField | 0〜3、既定0 | 技能レベル。**ベース区分では使わない** |
| `notes` | HTMLField | | 備考。`htmlFields` に宣言済み |

`characteristicOptions` が2件以上あるとシートに能力値の選択欄が出て、1件なら表示だけになる。組込技能は `choices` の有無というスキーマの形で出し分けているが、Itemのスキーマは全インスタンス共通なので技能ごとに変えられず、**件数で決める**形にしている。

区分ごとに `level` の範囲を変えることもできないので、スキーマは0〜3を許したまま読む側が固定する。派生値:

| 値 | 意味 |
|---|---|
| `isBase` / `isExtra` | 区分から導く。`＊` / `★` の表記と技能ポイントの倍計算に使う |

`characteristic` が `characteristicOptions` の外を指していたら `prepareDerivedData` が先頭に戻す。作者が参照能力値を絞ったあとも古い値が残ると、アクターが持たない能力値を引いてしまうため。

**特化（分野）は持たない。** 組込技能の8件にある `specialization` に相当するものは無い。

## ChatMessage `weapon`

武器カード。1枚のカードに攻撃判定とダメージを追記していくので、状態をメッセージ自身が持つ。

| パス | 型 | 既定 | 意味 |
|---|---|---|---|
| `weaponName` | StringField | `""` | 使用時の武器名 |
| `weaponImg` | StringField | `""` | 使用時の画像 |
| `skill` | StringField | `fight` | 参照技能。アイテム側と違い `choices` は無い |
| `attackPower` | StringField | `""` | 使用時の攻撃力の式 |
| `rangeLabel` | StringField | `""` | 翻訳済みの間合い表示 |
| `itemUuid` | DocumentUUIDField | `null` | 元の武器 |
| `actorUuid` | DocumentUUIDField | `null` | 使ったアクター |
| `successCount` | NumberField | `null` | 攻撃判定の成功数。`null` は「まだ振っていない」 |
| `damageTotal` | NumberField | `null` | ダメージ合計。`null` は「まだ振っていない」 |

**表示に要る値を使用時に焼き込んでいる**のは、あとで武器やアクターを消してもカードが読めるようにするため。`successCount` と `damageTotal` の `null` がそのままボタンの出し分けになる。

## ChatMessage `damageApplied`

ダメージ適用（とMP減少）の結果。行の表示は `content` に描き、境界の案内のボタン（状態の付与）に要る値を `system` に焼き込む。

| パス | 型 | 既定 | 意味 |
|---|---|---|---|
| `resource` | StringField | `hp` | どのリソースの結果か。`hp` / `mp` |
| `reduction` | NumberField | `0` | 適用時の軽減値。1回の適用で全対象に共通 |
| `targets` | ArrayField(SchemaField) | `[]` | 対象ごとの `actorUuid` / `name` / `before` / `after` / `armor` |

`targets[].armor` は実際に軽減へ使った防具の値で、対象ごとに違う（行の内訳「（防具 N）」の元）。`actorUuid` は境界の案内から状態を付与するときの参照で、アクターを消したあとも行が読めるよう名前と値は別に焼き込む。

## スキーマの外に保存しているもの

`flags.emoklore.externalUrl` — キャラクター保管所から取り込んだときの元URL。取り込みが書く唯一のフラグで、どのスキーマにも属さない。
