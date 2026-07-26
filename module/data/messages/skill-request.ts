import type { CardActions } from "../../utils/chat-card";
import { type CardIdentity, ChatCardModel } from "./card-model";

const { ArrayField, NumberField, SchemaField, StringField } = foundry.data.fields;

/** 要求された技能1つぶん。`kind` は判定の経路、`key` は技能キー */
export type RequestedSkill = {
  kind: "skill" | "base";
  key: string;
};

/** カードに焼き込む要求の内容。スキーマと同じ形 */
export type SkillRequestState = {
  skills: RequestedSkill[];
  requiredSuccess: number;
  bonus: number;
  successMod: number;
  note: string;
};

const defineSkillRequestSchema = () => ({
  // 「〈観察眼〉または〈＊知覚〉で判定」の形をそのまま持てるよう複数を許す。
  // カスタム技能は各アクター固有なので、要求の対象にはできない
  skills: new ArrayField(
    new SchemaField({
      kind: new StringField({
        required: true,
        blank: false,
        choices: ["skill", "base"],
        initial: "skill",
      }),
      key: new StringField({ required: true, blank: false }),
    }),
  ),

  // 要求する成功数。0は指定なし
  requiredSuccess: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),

  // PLの判定に載せる修正。判定値修正はDLが状況で与えるものではなく効果の側なので持たない
  bonus: new NumberField({ required: true, integer: true, initial: 0 }),
  successMod: new NumberField({ required: true, integer: true, initial: 0 }),

  // 「ネット実況信用値÷2個のダイスボーナス」のような、機械に落ちない条件を添える
  note: new StringField({ required: true, blank: true, initial: "" }),
});

/**
 * DLからの判定要求のChatMessage。
 *
 * **出したら変わらない。** 本体は作成者にしか OWNER を返さない（`ChatMessage#getUserLevel`）
 * ので、DLが出したカードをPLが更新することはサーバに拒否される。誰が振ったかをカードへ
 * 書き戻す形にはせず、各自の判定結果は別のメッセージとして出す（生存リマインダと同じ）。
 *
 * ボタンのハンドラは持たない。判定を駆動するので `applications/` 側に置き、`emoklore.ts` の
 * init が `ACTIONS` へ登録する（architecture.md 課題5 を繰り返さない）。
 */
export class SkillRequestModel extends ChatCardModel {
  declare skills: RequestedSkill[];
  declare requiredSuccess: number;
  declare bonus: number;
  declare successMod: number;
  declare note: string;

  static override CARD: CardIdentity = {
    root: ".em-skill-request",
    type: "skillRequest",
  };

  /** カードのボタン。`data-action` の値と対応する。モジュールはここに足せる */
  static override ACTIONS: CardActions<SkillRequestModel> = {};

  static override defineSchema() {
    return defineSkillRequestSchema();
  }
}
