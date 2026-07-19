import type { ApplicationRenderContext, ApplicationTab } from "@client/applications/_types.mjs";
import type { HandlebarsRenderOptions } from "@client/applications/api/handlebars-application.mjs";
import type { CharacterDataModel } from "../data/character";
import type { EmokloreActor } from "../documents/actor";

// Common type definitions
export type EmotionKey = "surface" | "hidden" | "root";

/** 共鳴感情の表示用データ。どちらも翻訳済みの文字列で、未選択なら空文字 */
export type EmotionRow = { label: string; attribute: string };

// renderに独自オプション（mode等）を載せて受け渡すための型
export type EmokloreRenderOptions = HandlebarsRenderOptions & {
  mode?: number;
  renderContext?: string;
  [key: string]: unknown;
};

export type SkillRow = {
  level: number;
  isExtra?: boolean;
  /** 能力値の表示名。CONFIG.EMOKLORE から引いた翻訳済みの文字列 */
  characteristicLabel: string;
  [key: string]: unknown;
};

/** 経歴の項目の定義。並び順と見せ方だけを持ち、値は持たない */
export type BiographyFieldDef = {
  key: string;
  /** ラベルと値を横に並べる */
  inline?: boolean;
  /** 値をHTMLとして流し込む */
  html?: boolean;
};

/** 経歴1項目の表示用データ */
export type BiographyRow = {
  key: string;
  label: string;
  /** 保存値そのまま。編集モードの formGroup に渡す */
  value: string;
  /** 閲覧モードで出す文字列。備考は enrichHTML を通した結果が入る */
  display: string;
  field: unknown;
  inline: boolean;
  html: boolean;
};

/** 基本技能の表示用データ。判定のトリガとして1行1ボタンで並べる */
export type BaseSkillRow = {
  key: string;
  /** 翻訳済みの表示名 */
  label: string;
  target: number;
  /** 能力値のFont Awesomeアイコンクラス */
  characteristicIcon: string;
};

export type CharacteristicsMap = Record<
  string,
  { field: foundry.data.fields.DataField; value: number }
>;

export type EmokloreActorSheetActions = {
  roll: (event: Event, target: HTMLElement) => Promise<unknown>;
  // mixin側のDEFAULT_OPTIONSから継承チェーン経由でマージされるので、各シートでの宣言は任意
  toggleMode?: (event: Event, target: HTMLElement) => Promise<void>;
};

// window / form は mixin 側の DEFAULT_OPTIONS が継承チェーン経由でマージされるため任意
export interface EmokloreActorSheetOptions {
  classes: string[];
  actions: EmokloreActorSheetActions;
  window?: {
    resizable: boolean;
  };
  form?: {
    submitOnChange: boolean;
  };
}

/**
 * シートが参照するドキュメントのメンバー。
 *
 * 本体の ClientDocumentMixin はJSDocがジェネリクスを消しているため、
 * これらが Document の型に出てこない。実際に使うものだけを交差型で補う。
 */
export type SheetDocument = foundry.abstract.Document & {
  isOwner: boolean;
  limited: boolean;
  documentName: string;
  system: { schema: { fields: Record<string, foundry.data.fields.DataField> } };
  flags: Record<string, unknown>;
};

export interface EmokloreDocumentSheetContext extends ApplicationRenderContext {
  isPlay: boolean;
  owner: boolean;
  limited: boolean;
  gm: boolean;
  // ドキュメント種別を問わない基底なので絞らない。
  // 各シートが自分のコンテキスト型（CharacterContext など）で具体化する
  document: unknown;
  system: unknown;
  systemFields: Record<string, foundry.data.fields.DataField>;
  flags: Record<string, unknown>;
  [key: string]: unknown;
}

// window / form はサブクラス側で省略できる（mixinのDEFAULT_OPTIONSがマージされるため）
export interface EmokloreDocumentSheetOptions {
  classes: string[];
  actions: Record<string, (event: Event, target: HTMLElement) => Promise<unknown>>;
  window?: {
    resizable: boolean;
  };
  form?: {
    submitOnChange: boolean;
  };
}

export type CharacterContext = {
  config: typeof CONFIG.EMOKLORE;
  system: CharacterDataModel;
  // テンプレートが system.emotions も参照するので、紛れないよう emotionRows にしている
  emotionRows: Record<EmotionKey, EmotionRow>;
  emotionOptions: Array<{ value: string; label: string; group: string }>;
  characteristics?: CharacteristicsMap;
  charPointSum?: number;
  skills?: Record<string, SkillRow>;
  baseSkills?: BaseSkillRow[];
  skillPointSum?: number;
  skillLevelOptions?: Array<{ value: string; label: string }>;
  // 経歴は横並びの組（年齢・性別）と、それ以降を分けて渡す
  biographyPairedRows?: BiographyRow[];
  biographyRows?: BiographyRow[];
  tabs: Record<string, ApplicationTab>;
  tab?: unknown;
  effects?: ReturnType<typeof import("../utils/effects").prepareActiveEffectCategories>;
  // DocumentSheetContext properties
  isPlay: boolean;
  owner: boolean;
  limited: boolean;
  gm: boolean;
  document: EmokloreActor;
  systemFields: Record<string, foundry.data.fields.DataField>;
  flags: Record<string, unknown>;
};

export type EmokloreCharacterSheetActions = {
  viewDoc: (event: Event, target: HTMLElement) => Promise<void>;
  createDoc: (event: Event, target: HTMLElement) => Promise<void>;
  deleteDoc: (event: Event, target: HTMLElement) => Promise<void>;
  toggleEffect: (event: Event, target: HTMLElement) => Promise<void>;
  roll: (event: Event, target: HTMLElement) => Promise<unknown>;
  // mixin側のDEFAULT_OPTIONSから継承チェーン経由でマージされるので、各シートでの宣言は任意
  toggleMode?: (event: Event, target: HTMLElement) => Promise<void>;
};
