import type { ResonantEmotionKey } from "../config/resonant-emotions";
import { EmokloreSystemDataModel } from "./system-model";

const {
  ArrayField,
  BooleanField,
  DocumentUUIDField,
  HTMLField,
  NumberField,
  SchemaField,
  SetField,
  StringField,
} = foundry.data.fields;

/**
 * 怪異の攻撃・固有技能1つぶん。
 *
 * 判定は能力値から派生させず、ダイス数と判定値を直接持つ（シナリオが `2DM≦7` の形で
 * 与えるため。固有技能の判定値は能力値+レベルに限らない）。ダメージは自由Roll式で、
 * 成功数は `@success` で参照できる。
 */
export type KaiAttack = {
  name: string;
  /** 振るダイスの数 */
  diceCount: number;
  /** 判定値（NDM≦X の X） */
  target: number;
  /** ダメージの自由Roll式。成功数は @success で参照する */
  damage: string;
  /** 消費MP。任意なので既定0 */
  mpCost: number;
  /** 判定なし・固定成功数の行動か */
  judgeless: boolean;
  /** judgeless のときに使う固定成功数 */
  fixedSuccess: number;
};

// ダメージ式が妥当なRoll式かを確かめる。空は許す。成功数の @success は本体の validate が
// @参照を1に置き換えて評価するので、そのまま通る（差し替えは rules/kai-attack が行う）
const diceFormulaValidator = (value: unknown) => {
  if (typeof value === "string" && value !== "" && !foundry.dice.Roll.validate(value)) return false;
  return undefined;
};

const defineKaiDataModelSchema = () => ({
  resources: new SchemaField({
    // 怪異のHP/MPは能力値からの派生ではなく、シナリオが直接与える固定値。
    // だから最大値も保存する（共鳴者・人間NPCの派生とは違う）
    hp: new SchemaField({
      value: new NumberField({ required: true, integer: true, min: 0, initial: 10 }),
      max: new NumberField({ required: true, integer: true, min: 0, initial: 10 }),
    }),
    mp: new SchemaField({
      value: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      max: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
    }),
    // 装甲。受けるダメージを平坦に軽減する（ストーンマン35など）。任意なので既定0
    armor: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
  }),

  // シナリオが与える固定のイニシアチブ値。getRollData 展開で @initiative に解決し、
  // 既定の【身体】＋〈スピード〉基準のエンカウンターでそのまま並ぶ。能力値を持たないので、
  // 非既定の基準（@characteristics.X.value）では解決できないが、基準はDLが選ぶので許容する
  initiative: new NumberField({ required: true, integer: true, initial: 0 }),

  // 共鳴感情（複数）。編集は怪異シートの感情ピッカーが行う。
  // 保存されるのは感情キー。ラベルは CONFIG.EMOKLORE から引く
  emotions: new SetField(
    new StringField({
      required: true,
      blank: false,
      choices: Object.keys(CONFIG.EMOKLORE.resonantEmotions),
    }),
  ),

  // 共鳴判定のプリセット。怪異シートの「共鳴判定を要求」がこの値で要求カードを出す
  resonance: new SchemaField({
    // 強度（判定値）
    intensity: new NumberField({ required: true, integer: true, min: 1, initial: 5 }),
    // 上昇値。成功時の〈∞共鳴〉上昇量。ダイス式も受ける（公式シナリオに 上昇1D3 の例）。
    // ここは値を保持するだけで、上昇の適用は applications/requests.ts の raiseResonance が行う
    rise: new StringField({
      required: true,
      blank: true,
      initial: "1",
      validate: diceFormulaValidator,
      validationError: "is not a valid dice formula",
    }),
  }),

  // 使用する共鳴表への参照。ハウリングが起きたら共鳴結果カードのボタンがここを引く。
  // 引く側は `RollTable#roll()` を使う（`draw()` は replacement:false の表で書き込みが
  // 走り、PLがGM所有の表を引くと権限エラーになる。utils/howling.ts を参照）
  resonanceTable: new DocumentUUIDField({ type: "RollTable", nullable: true, initial: null }),

  // 憑依時の変異など、機械的効果に落ちない自由記述
  mutation: new HTMLField({ required: true, blank: true }),

  // 攻撃・固有技能のリスト
  attacks: new ArrayField(
    new SchemaField({
      name: new StringField({ required: true, blank: true, initial: "" }),
      diceCount: new NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      target: new NumberField({ required: true, integer: true, min: 0, initial: 7 }),
      // 公式シナリオに D4 が出るため、武器の DamageDie 列挙には収めず自由式にする
      damage: new StringField({
        required: true,
        blank: true,
        initial: "",
        validate: diceFormulaValidator,
        validationError: "is not a valid dice formula",
      }),
      mpCost: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      // 判定なし・固定成功数の行動を表す（妖精の夜の夢「判定なし：成功数1」）
      judgeless: new BooleanField({ required: true, initial: false }),
      fixedSuccess: new NumberField({ required: true, integer: true, min: 0, initial: 1 }),
    }),
  ),
});

/**
 * 怪異のデータモデル。
 *
 * 能力値の標準ステータスブロックを持たない別形状なので `CharacterLikeDataModel` は継承せず、
 * `EmokloreSystemDataModel` を直に継承する。持つのは HP/装甲/MP・固定イニシアチブ・
 * 共鳴感情（複数）・共鳴判定のプリセット・共鳴表参照・憑依変異・直接判定の攻撃リスト。
 *
 * HP/MP は `resources.hp/mp`（value/max）を共鳴者・人間NPCと同形にしてあり、
 * `EmokloreActor#applyDamage` などの共通のリソース操作がそのまま効く。
 */
export class KaiDataModel extends EmokloreSystemDataModel {
  declare resources: {
    hp: { value: number; max: number };
    mp: { value: number; max: number };
    armor: number;
  };
  declare initiative: number;
  declare emotions: Set<ResonantEmotionKey>;
  declare resonance: { intensity: number; rise: string };
  declare resonanceTable: string | null;
  declare mutation: string;
  declare attacks: KaiAttack[];

  static override defineSchema() {
    return defineKaiDataModelSchema();
  }

  static override LOCALIZATION_PREFIXES = ["EMOKLORE.Actor.kai"];
}
