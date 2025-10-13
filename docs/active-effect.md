# 効果（Active Effect）
## 基本的な使い方
極限共鳴やシナリオのギミックなどによって得られる，ダイスボーナスや判定値や成功数の修正をこの機能を用いて行えます．

例えば「【身体】を使用する技能での判定は［成功数］-1される」を実現したいときは，属性キーに`system.characteristics.physical.mod.success`，モードは`追加`，効果値に`-1`と入力すれば判定の際に反映されます．

:::info
現状キャラシからは変化がわからない，アップデート予定
:::

大文字小文字も含めて誤字があると動作しないので気をつけてください．

## 属性キーの一覧
使用を想定しているものの一覧です．現在は技能周りのみ．もっと変更できる箇所はありますが，動作確認していません．
### 「【能力値】を使用する技能での判定」の修正
`能力値`を対応する英単語に書き換えて使用してください．
##### ダイスボーナス：`system.characteristics.能力値.mod.bonus`
##### 判定値：`system.characteristics.能力値.mod.target`
##### 成功数：`system.characteristics.能力値.mod.success`

- 身体：`physical`
- 器用：`dexterity`
- 精神：`mentality`
- 五感：`sensitivity`
- 知力：`intelligence`
- 魅力：`charisma`
- 社会：`sociality`
- 運勢：`fortune`

例えば「【精神】を使用する技能での判定にダイスボーナス+1」の属性キーは`system.characteristics.mentality.mod.bonus`となります．

### 「〇〇系技能の判定」の修正
`グループ`を対応する英単語に書き換えて使用してください．
##### ダイスボーナス：`system.skillGroups.グループ.mod.bonus`
##### 判定値：`system.skillGroups.グループ.mod.target`
##### 成功数：`system.skillGroups.グループ.mod.success`
- 調査系：`investigation`
- 知覚系：`perception`
- 交渉系：`negotiations`
- 情報系`knowledge`
- 運動系：`athletic`
- 生存系：`survival`
- 特殊：`unique`

### 個別の技能 の修正
`技能`を対応する英単語に書き換えて使用してください．
##### ダイスボーナス：`system.skills.技能.mod.bonus`
##### 判定値：`system.skills.技能.mod.target`
##### 成功数：`system.skills.技能.mod.success`
- 検索：`search`
- 洞察：`insight`
- マッピング：`mapping`
- 直感：`instinct`
- 鑑定：`appraisal`
- 観察眼：`keenObservation`
- 聞き耳：`listen`
- 毒味：`taste`
- 危機察知：`threatDetection`
- 霊感：`spiritualSense`
- 社交術：`etiquette`
- ディベート：`debate`
- 魅了：`charm`
- 心理：`psychology`
- 専門知識：`specializedKnowledge`
- 事情通：`insider`
- 業界：`industryKnowledge`
- スピード：`speed`
- ストレングス：`strength`
- アクロバット：`acrobatics`
- ダイブ：`dive`
- 武術：`martialArt`
- 奥義：`secretTechnique`
- 射撃：`rangedAttack`
- 耐久：`endurance`
- 根性：`grit`
- 医術：`medicine`
- 蘇生：`resurrection`
- 技巧：`technique`
- 芸術：`art`
- 操縦：`pilot`
- 暗号：`cipher`
- 電脳：`computer`
- 隠匿：`stealth`
- 強運：`strongLuck`

### 個別のベース技能 の修正
`ベース技能`を対応する英単語に書き換えて使用してください．
##### ダイスボーナス：`system.baseSkills.ベース技能.mod.bonus`
##### 判定値：`system.baseSkills.ベース技能.mod.target`
##### 成功数：`system.baseSkills.ベース技能.mod.success`
- 調査：`investigation`
- 知覚：`perception`
- 交渉：`negotiations`
- 知識：`knowledge`
- ニュース：`news`
- 運動：`athletic`
- 格闘：`fight`
- 投擲：`throw`
- 生存：`survival`
- 自我：`self`
- 手当て：`treatment`
- 細工：`handiwork`
- 幸運：`luck`
