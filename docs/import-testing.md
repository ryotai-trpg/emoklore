# キャラクターシートインポート機能

## 使い方

1. [キャラクター保管所](https://emoklore.charasheet.jp)でキャラクターを作成または開く
2. キャラクターページの「チャパレ」ボタンをクリック
3. CCFOLIA形式でコピーを選ぶ
4. 出力されたJSONをコピー
5. Foundry VTTでキャラクターシートを開き、編集モードに切り替える
6. キャラ画像の隣のインポートボタン（📄アイコン）をクリック
7. コピーしたJSONを貼り付けて「インポート」をクリック

## サンプルJSON

テストに使用できるサンプルキャラクターJSONです：

```json
{"kind":"character","data":{"params":[{"label":"身体","value":"4"},{"label":"器用","value":"5"},{"label":"精神","value":"3"},{"label":"五感","value":"6"},{"label":"知力","value":"2"},{"label":"魅力","value":"2"},{"label":"社会","value":"3"},{"label":"運勢","value":"1"}],"status":[{"label":"HP","value":"14","max":"14"},{"label":"MP","value":"5","max":"5"},{"label":"共鳴","value":1,"max":9}],"name":"テスト　テスト","initiative":4,"memo":"ふりがな:てすと　てすと\n共鳴感情・表: 怒り(情念)\n共鳴感情・裏: 依存(関係)\n共鳴感情・ルーツ: 友情(関係)\n      ","externalUrl":"https://emoklore.charasheet.jp/view/291","commands":"{共鳴}DM<={強度} 〈∞共鳴〉\n({共鳴}+1)DM<={強度} 〈∞共鳴〉ルーツ属性一致\n({共鳴}*2)DM<={強度} 〈∞共鳴〉完全一致\n2DM<=4 〈検索〉\n1DM<=3 〈洞察〉\n3DM<=9 〈マッピング〉\n2DM<=5 〈直感〉\n1DM<=7 〈観察眼〉\n1DM<=7 〈毒見〉\n1DM<=2 〈★強運〉\n1DM<=5 〈＊調査〉\n1DM<=6 〈＊知覚〉\n1DM<=2 〈＊交渉〉\n1DM<=2 〈＊知識〉\n1DM<=3 〈＊ニュース〉\n1DM<=4 〈＊運動〉\n1DM<=4 〈＊格闘〉\n1DM<=5 〈＊投擲〉\n1DM<=4 〈＊生存〉\n1DM<=3 〈＊自我〉\n1DM<=1 〈＊手当て〉\n1DM<=5 〈＊細工〉\n1DM<=1 〈＊幸運〉"}}
```

## 期待される結果

このキャラクターをインポートすると、以下のようになります：

### キャラクター名
- 名前：「テスト　テスト」

### 能力値
- 身体 (Physical): 4
- 器用 (Dexterity): 5
- 精神 (Mentality): 3
- 五感 (Sensitivity): 6
- 知力 (Intelligence): 2
- 魅力 (Charisma): 2
- 社会 (Sociality): 3
- 運勢 (Fortune): 1

### リソース
- HP: 14/14
- MP: 5/5
- 共鳴: 1/9

### 共鳴感情
- 表: 怒り（情念）
- 裏: 依存（関係）
- ルーツ: 友情（関係）

### 技能
コマンドフィールドから技能が計算されます：

- 検索 (Search): 2DM<=4 → レベル2
- 洞察 (Insight): 1DM<=3 → レベル1
- マッピング (Mapping): 3DM<=9 → レベル3
- 直感 (Instinct): 2DM<=5 → レベル2
- 観察眼 (Keen Observation): 1DM<=7 → レベル1
- 毒味 (Taste): 1DM<=7 → レベル1
- 強運 (Strong Luck): 1DM<=2 → レベル1（★マークのEX技能）

### メモ
フリガナや感情の詳細を含む完全なメモが経歴メモに保存されます。

### 外部URL
フラグとして保存：`flags.emoklore.externalUrl = "https://emoklore.charasheet.jp/view/291"`
