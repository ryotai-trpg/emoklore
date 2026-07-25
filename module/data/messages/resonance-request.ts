import { attachCardActions, type CardActions } from "../../utils/chat-card";
import { EmokloreSystemDataModel } from "../system-model";

const {
  ArrayField,
  BooleanField,
  DocumentUUIDField,
  NumberField,
  SchemaField,
  SetField,
  StringField,
} = foundry.data.fields;

/** 要求の対象1体ぶん。アクターを消したあとも読めるよう名前を焼き込む */
export type RequestTarget = {
  actorUuid: string | null;
  name: string;
};

// 上昇値が妥当なRoll式かを確かめる。空は許す（怪異の rise と同じ検証）
const diceFormulaValidator = (value: unknown) => {
  if (typeof value === "string" && value !== "" && !foundry.dice.Roll.validate(value)) return false;
  return undefined;
};

const defineResonanceRequestSchema = () => ({
  // 強度（判定値）。シナリオ独自のパラメータ連動で変わるので都度入力する
  intensity: new NumberField({ required: true, integer: true, min: 1, initial: 5 }),

  // 成功時の〈∞共鳴〉上昇量。ダイス式も受ける（公式シナリオに 上昇1D3 の例）。
  // 憑依判定では読まない（成否によらず固定+1）
  rise: new StringField({
    required: true,
    blank: true,
    initial: "1",
    validate: diceFormulaValidator,
    validationError: "is not a valid dice formula",
  }),

  // DLが指定する共鳴感情。空なら感情の指定なし。《怪異》は複数持つので複数受ける。
  // 保存されるのは感情キー（怪異の emotions と同じ形）
  emotions: new SetField(
    new StringField({
      required: true,
      blank: false,
      choices: Object.keys(CONFIG.EMOKLORE.resonantEmotions),
    }),
  ),

  // マッチングのGM強制。空なら感情から自動で決める。シナリオが「強制的に全員、
  // 振るダイスの数が倍になる」と指定するケースがある
  forcedMatch: new StringField({
    required: true,
    blank: true,
    initial: "",
    choices: ["", "none", "root", "completely"],
  }),

  // 憑依判定モード。上昇値は固定+1（成否不問）、ハウリングは起きない
  possessionMode: new BooleanField({ required: true, initial: false }),

  // 振ってほしい相手。空なら全共鳴者。表示だけで、押せる相手は絞らない
  targets: new ArrayField(
    new SchemaField({
      actorUuid: new DocumentUUIDField({ type: "Actor", nullable: true, initial: null }),
      name: new StringField({ required: true, blank: true, initial: "" }),
    }),
  ),

  // 判定の出どころの怪異。ハウリングでどの共鳴表を引くかを #79 がここから辿る
  kaiUuid: new DocumentUUIDField({ type: "Actor", nullable: true, initial: null }),
});

/**
 * DLからの共鳴判定・憑依判定の要求。
 *
 * 判定要求カード（`skillRequest`）と同じく**出したら変わらない**。本体は作成者にしか
 * OWNER を返さないので、PLは更新できない。各自の結果は別のメッセージとして出る。
 *
 * ボタンのハンドラは持たない。判定と共鳴値の更新を駆動するので `applications/` 側に置き、
 * `emoklore.ts` の init が `ACTIONS` へ登録する（architecture.md 課題5 を繰り返さない）。
 */
export class ResonanceRequestModel extends EmokloreSystemDataModel {
  declare intensity: number;
  declare rise: string;
  declare emotions: Set<string>;
  declare forcedMatch: string;
  declare possessionMode: boolean;
  declare targets: RequestTarget[];
  declare kaiUuid: string | null;

  /** カードのボタン。`data-action` の値と対応する。モジュールはここに足せる */
  static ACTIONS: CardActions<ResonanceRequestModel> = {};

  static override defineSchema() {
    return defineResonanceRequestSchema();
  }

  static override LOCALIZATION_PREFIXES = ["EMOKLORE.ChatMessage.resonanceRequest"];

  /** ボタンに反応する。`renderChatMessageHTML` から呼ばれる（配線は utils/chat-card.ts） */
  addListeners(html: HTMLElement): void {
    attachCardActions(html, {
      root: ".em-resonance-request",
      model: this,
      actions: ResonanceRequestModel.ACTIONS,
      label: "共鳴判定要求カード",
      errorKey: "EMOKLORE.ChatMessage.resonanceRequest.ActionFailed",
    });
  }
}
