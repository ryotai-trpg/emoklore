# データモデル

アクター・アイテム・チャットメッセージが保存する値の一覧。スキーマの正は `module/data/` のコードで、このページはその読み方を説明するもの。**キーと日本語名の対応は `npm run check:schema-doc` が `module/config/` と突き合わせている**ので、綴りがずれたままになることはない。

ActiveEffectでどのキーを変更できるかは [効果（ActiveEffect）](/active-effect) にある。

## 登録されている種別

| ドキュメント | 種別 | データモデル |
|---|---|---|
| Actor | `character` | `CharacterDataModel` |
| Actor | `npc` | `NpcDataModel` |
| Actor | `kai` | `KaiDataModel` |
| Item | `weapon` | `WeaponDataModel` |
| Item | `armor` | `ArmorDataModel` |
| Item | `skill` | `SkillDataModel` |
| ChatMessage | `weapon` | `WeaponCardModel` |
| ChatMessage | `kaiAttack` | `KaiAttackCardModel` |
| ChatMessage | `damageApplied` | `DamageAppliedModel` |
| ChatMessage | `survivalReminder` | `SurvivalReminderModel` |
| ChatMessage | `skillRequest` | `SkillRequestModel` |
| ChatMessage | `resonanceRequest` | `ResonanceRequestModel` |
| ChatMessage | `resonanceOutcome` | `ResonanceOutcomeModel` |
| Combat | `standard` | `CombatDataModel` |

**種別は `system.json` の `documentTypes` と `CONFIG.*.dataModels` の両方に書く。** 片方だけでは噛み合わない。`documentTypes` に無い種別を `dataModels` に登録すると、作成できないのに `system` の型だけが増えて嘘になる（警告も出ない）。

Actorは3種別あり、`EmokloreActor#system` はそれらのunion。共鳴者（`character`）と人間NPC（`npc`）は能力値・技能・派生値・技能判定を `CharacterLikeDataModel`（`module/data/character-like.ts`）で共有し、`character` はそこに共鳴値・共鳴感情・経歴を足す。`npc` は追加を持たない軽量版で、邪気（旧 `wickedness`）はルールブックに該当が無いので落とした。怪異（`kai`）は能力値の標準ブロックを持たない別形状（下記）。

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
| `resources.resonance.mod` | SchemaField | — | 共鳴判定への修正（残響「ハーモニー」）。技能側の `mod` と同じ3値で、同じく `persisted: false` |

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

これに `acquired`（SetField、既定 `[]`）が加わる。共振や怪異の付与で後から増える枠で、枚数が決まらないので Set で持つ。**3枠を配列に畳まないのは、ルーツだけが属性一致の判定対象だから**で、畳むと「ルーツが2つある」状態が表現できてしまう。感情マッチングは3枠と `acquired` を合わせて見る。

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

## Actor `npc`

人間NPC。`CharacterLikeDataModel` を継承し、`character` から共鳴値・共鳴感情・経歴を除いたもの。能力値・技能・基本技能・カスタム技能・技能グループ・`resources.hp/mp`・`mod`・導出値（`initiative` を含む）は共鳴者と同じなので、上の `Actor character` の各節を参照。判定の計算（`getSkillRollContext` / `derived-values`）も共鳴者と1つの実装を共有する。

## Actor `kai`

怪異。能力値の標準ブロックを持たない別形状で、`CharacterLikeDataModel` は継承しない。攻撃の判定は能力値から派生させず、ダイス数と判定値を直接持つ。

| パス | 型 | 既定 | 意味 |
|---|---|---|---|
| `resources.hp` | SchemaField | value 10 / max 10 | HP。派生ではなくシナリオが与える固定値なので max も保存する |
| `resources.mp` | SchemaField | value 0 / max 0 | MP。同上 |
| `resources.armor` | NumberField | 0 | 装甲。受けるダメージを平坦に軽減する（`applyDamage` が自前で引く） |
| `initiative` | NumberField | 0 | 固定イニシアチブ値。`getRollData` 展開で `@initiative` に解決し、既定の【身体】＋〈スピード〉基準で並ぶ |
| `emotions` | SetField(StringField) | `[]` | 共鳴感情（複数）。値は感情キー。#74 の感情ピッカーで編集UIを置き換える |
| `resonance.intensity` | NumberField | 5 | 共鳴判定の強度（判定値）のプリセット |
| `resonance.rise` | StringField | `"1"` | 上昇値。ダイス式も受ける（`Roll.validate` で検証）。適用は #75 |
| `resonanceTable` | DocumentUUIDField | `null` | 使う共鳴表/デッキへの参照。引く処理は #79 |
| `mutation` | HTMLField | `""` | 憑依時の変異などの自由記述。`system.json` の `htmlFields` に宣言 |
| `attacks` | ArrayField(SchemaField) | `[]` | 攻撃・固有技能のリスト（下記） |

攻撃1件は `name` / `diceCount`（ダイス数）/ `target`（判定値）/ `damage`（自由Roll式。成功数は `@success`。`Roll.validate` で検証）/ `mpCost` / `judgeless`（判定なし）/ `fixedSuccess`（judgeless時の固定成功数）を持つ。ダメージにD4が出るため武器の `DamageDie`（d3/d6）列挙には収めず自由式にしている。判定の組み立てと `@success` の差し替えは `module/rules/kai-attack.ts`。

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

## ChatMessage `kaiAttack`

怪異の攻撃カード。武器カードと違い育たず、判定とダメージを一度に振って1枚に出す。

| パス | 型 | 既定 | 意味 |
|---|---|---|---|
| `attackName` | StringField | `""` | 攻撃名 |
| `actorUuid` | DocumentUUIDField | `null` | 振った怪異。ダメージ適用の参照 |
| `mpCost` | NumberField | 0 | 消費MP（表示のみ） |
| `judgeless` | BooleanField | `false` | 判定なしの攻撃か |
| `successCount` | NumberField | `null` | 判定の成功数（judgeless なら固定成功数） |
| `damageTotal` | NumberField | `null` | ダメージ合計 |

ボタンのハンドラ（ダメージ適用）は `data/` に置かず、`applications/kai-attack.ts` のものを `emoklore.ts` の init が `ACTIONS` へ登録する（[アーキテクチャ](/architecture)の課題5 の再演を避ける）。

## ChatMessage `damageApplied`

ダメージ適用（とMP減少）の結果。行の表示は `content` に描き、境界の案内のボタン（状態の付与）に要る値を `system` に焼き込む。

| パス | 型 | 既定 | 意味 |
|---|---|---|---|
| `resource` | StringField | `hp` | どのリソースの結果か。`hp` / `mp` |
| `reduction` | NumberField | `0` | 適用時の軽減値。1回の適用で全対象に共通 |
| `targets` | ArrayField(SchemaField) | `[]` | 対象ごとの `actorUuid` / `name` / `before` / `after` / `armor` |

`targets[].armor` は実際に軽減へ使った防具の値で、対象ごとに違う（行の内訳「（防具 N）」の元）。`actorUuid` は境界の案内から状態を付与するときの参照で、アクターを消したあとも行が読めるよう名前と値は別に焼き込む。

## ChatMessage `survivalReminder`

ラウンド終了時、【心肺停止】のキャラクターに〈＊生存〉判定を促すリマインダ。damageApplied と同じ `system.addListeners` の配線に乗る。

| パス | 型 | 既定 | 意味 |
|---|---|---|---|
| `round` | NumberField | `0` | 対象となったラウンド |
| `targets` | ArrayField(SchemaField) | `[]` | 対象ごとの `actorUuid` / `name` |

## ChatMessage `skillRequest`

DLからの判定要求。**出したら変わらない** — 本体は作成者にしか OWNER を返さないので（`ChatMessage#getUserLevel`）、DLが出したカードをPLが更新することはできない。各自の判定結果は別のメッセージとして出る。

| パス | 型 | 既定 | 意味 |
|---|---|---|---|
| `skills` | ArrayField(SchemaField) | `[]` | 要求する技能。`kind`（`skill` / `base`）と `key` の対。カスタム技能はアクター固有なので入らない |
| `requiredSuccess` | NumberField | `0` | 要求する成功数。0は指定なし |
| `bonus` | NumberField | `0` | PLの判定に載せるダイスボーナス |
| `successMod` | NumberField | `0` | 同じく成功数修正 |
| `note` | StringField | `""` | 機械に落ちない条件の補足 |

判定値修正は持たない。DLが状況で与えるものではなく、状態異常や極限共鳴の[効果](/active-effect)の側にあるため。

## ChatMessage `resonanceRequest`

DLからの共鳴判定・憑依判定の要求。判定要求カードと同じく**出したら変わらない**。

| パス | 型 | 既定 | 意味 |
|---|---|---|---|
| `intensity` | NumberField | 5 | 強度（判定値） |
| `rise` | StringField | `"1"` | 成功時の〈∞共鳴〉上昇量。ダイス式も受ける（`Roll.validate` で検証）。憑依判定では読まない |
| `emotions` | SetField(StringField) | `[]` | DLが指定する共鳴感情。**《怪異》は複数持つので複数受ける**。空なら指定なし |
| `forcedMatch` | StringField | `""` | 一致度のGM強制。空なら感情から自動で決める |
| `possessionMode` | BooleanField | `false` | 憑依判定モード。成否によらず+1、ハウリングなし |
| `targets` | ArrayField(SchemaField) | `[]` | 対象の `actorUuid` / `name`。**表示だけ**で、押せる相手は絞らない |
| `kaiUuid` | DocumentUUIDField | `null` | 判定の出どころの怪異。どの共鳴表を引くかを #79 がここから辿る |

## ChatMessage `resonanceOutcome`

共鳴判定のあと始末。〈∞共鳴〉の変化とハウリングの発生を1体ぶん記録する。

| パス | 型 | 既定 | 意味 |
|---|---|---|---|
| `actorUuid` / `name` | DocumentUUIDField / StringField | `null` / `""` | 振った共鳴者 |
| `successCount` | NumberField | 0 | 判定の成功数 |
| `rise` / `before` / `after` | NumberField | 0 / 1 / 1 | 上がった量と、前後の〈∞共鳴〉 |
| `howling` | BooleanField | `false` | トリプル以上でハウリング発生。憑依判定では起きない |
| `possessionReached` | BooleanField | `false` | 憑依判定で成功数が【精神】以上に届いたか |
| `kaiUuid` | DocumentUUIDField | `null` | 引く共鳴表を辿るための怪異。#79 が使う |

ボタンはまだ無い。ハウリングの「表を引く／カードを引く」は #79 が `ACTIONS` に足す。

## Combat `standard`

エンカウンターのイニシアチブ基準（能力値＋技能）を持つ。**全Combatはこの単一種別に寄る** — `EmokloreCombat` が `base` を `standard` に初期化するので、種別を選ばせなくても基準を必ず持てる。

| パス | 型 | 既定 | 意味 |
|---|---|---|---|
| `characteristic` | StringField | `physical` | イニシアチブに使う能力値 |
| `skill` | StringField | `speed` | 足す技能。空文字なら技能なし（【心肺停止】の【器用】単独） |

イニシアチブ値そのものは保存しない。`CombatDataModel#formula` が基準から式を組み立て、`EmokloreCombatant#_getInitiativeFormula` がロール時に返す。設計の詳細は [アーキテクチャ](/architecture) にある。

## スキーマの外に保存しているもの

`flags.emoklore.externalUrl` — キャラクター保管所から取り込んだときの元URL。取り込みが書く唯一のフラグで、どのスキーマにも属さない。
