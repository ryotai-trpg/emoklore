import type { EmokloreActor } from "../documents/actor";
import type { CharacterDataModel } from "../data/character";

// Common type definitions
export type EmotionKey = "surface" | "hidden" | "root";

export type SkillRow = {
  level: number;
  isExtra?: boolean;
  [key: string]: unknown;
};

export type CharacteristicsMap = Record<
  string,
  { field: foundry.data.fields.DataField; value: number }
>;

export type EmokloreActorSheetActions = {
  roll: (event: Event, target: HTMLElement) => Promise<any>;
  increaseResources: (event: Event, target: HTMLElement) => Promise<any>;
  decreaseResources: (event: Event, target: HTMLElement) => Promise<any>;
  toggleMode: (event: Event, target: HTMLElement) => Promise<void>;
};

export interface EmokloreActorSheetOptions {
  classes: string[];
  actions: EmokloreActorSheetActions;
  window: {
    resizable: boolean;
  };
  form: {
    submitOnChange: boolean;
  };
}

export interface EmokloreDocumentSheetContext {
  isPlay: boolean;
  owner: boolean;
  limited: boolean;
  gm: boolean;
  document: any;
  system: any;
  systemFields: Record<string, foundry.data.fields.DataField>;
  flags: Record<string, unknown>;
  [key: string]: unknown;
}

export interface EmokloreDocumentSheetOptions {
  classes: string[];
  actions: Record<string, (event: Event, target: HTMLElement) => Promise<void>>;
  window: {
    resizable: boolean;
  };
  form: {
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
  tabs: Record<string, unknown>;
  tab?: unknown;
  effects?: any;
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
  roll: (event: Event, target: HTMLElement) => Promise<any>;
  increaseResources: (event: Event, target: HTMLElement) => Promise<any>;
  decreaseResources: (event: Event, target: HTMLElement) => Promise<any>;
  toggleMode: (event: Event, target: HTMLElement) => Promise<void>;
};

export type SkillPointCalculation = {
  skills: Array<{ level: number; isExtra?: boolean }>;
  exSkills: Array<{ level: number; isExtra?: boolean }>;
};
