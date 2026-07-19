import type { ApplicationRenderContext, ApplicationTab } from "@client/applications/_types.mjs";
import type { HandlebarsRenderOptions } from "@client/applications/api/handlebars-application.mjs";
import type { CharacterDataModel } from "../data/character";
import type { EmokloreActor } from "../documents/actor";

// Common type definitions
export type EmotionKey = "surface" | "hidden" | "root";

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

export type CharacteristicsMap = Record<
  string,
  { field: foundry.data.fields.DataField; value: number }
>;

export type EmokloreActorSheetActions = {
  roll: (event: Event, target: HTMLElement) => Promise<unknown>;
  increaseResources: (event: Event, target: HTMLElement) => Promise<unknown>;
  decreaseResources: (event: Event, target: HTMLElement) => Promise<unknown>;
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
  emotionAttributes: Record<EmotionKey, string>;
  emotionOptions: Array<{ value: string; label: string; group: string }>;
  characteristics?: CharacteristicsMap;
  charPointSum?: number;
  skills?: Record<string, SkillRow>;
  skillPointSum?: number;
  skillLevelOptions?: Array<{ value: string; label: string }>;
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
  increaseResources: (event: Event, target: HTMLElement) => Promise<unknown>;
  decreaseResources: (event: Event, target: HTMLElement) => Promise<unknown>;
  // mixin側のDEFAULT_OPTIONSから継承チェーン経由でマージされるので、各シートでの宣言は任意
  toggleMode?: (event: Event, target: HTMLElement) => Promise<void>;
};
