import type { ApplicationRenderContext, ApplicationTab } from "@client/applications/_types.mjs";
import type { HandlebarsRenderOptions } from "@client/applications/api/handlebars-application.mjs";
import type { CharacteristicKey } from "../config/characteristics";
import type { CharacterDataModel } from "../data/character";
import type { ArmorDataModel, SkillDataModel, WeaponDataModel } from "../data/item-models";
import type { EmokloreActor } from "../documents/actor";
import type { EmokloreItem } from "../documents/item";
import type { ModifierSet } from "../rules/types";
import type { ValueSegment } from "./helpers";

/**
 * `HandlebarsApplicationMixin` の返り値に足りない静的メンバー。
 *
 * 本体のJSDocは `@param {Constructor<ApplicationV2>}` とインスタンス側しか宣言していないので
 * （`client/applications/api/handlebars-application.mjs:32`）、mixinを通すと `ApplicationV2` の
 * 静的メンバーが型から落ち、`DEFAULT_OPTIONS` / `TABS` を `override` で名乗れなくなる（TS4113）。
 * 実際に override しているものだけ交差型で足す。本体が静的側を持つようになったら消せる。
 */
export type ApplicationV2Statics = Pick<
  typeof foundry.applications.api.ApplicationV2,
  "DEFAULT_OPTIONS" | "TABS"
>;

export type EmotionKey = "surface" | "hidden" | "root";

/** 共鳴感情の表示用データ。どちらも翻訳済みの文字列で、未選択なら空文字 */
export type EmotionRow = { label: string; attribute: string };

// renderに独自オプション（mode等）を載せて受け渡すための型
export type EmokloreRenderOptions = HandlebarsRenderOptions & {
  mode?: number;
  renderContext?: string;
};

/** 技能1行の表示用データ。保存値と CONFIG.EMOKLORE 側の定義を合流させたもの */
export type SkillRow = {
  /**
   * スキーマのフィールド。編集モードで formInput に渡す。
   *
   * `schema.getField()` は見つからなければ undefined を返す。スキーマは
   * CONFIG.EMOKLORE と同じキー集合から作るので実際には引けるが、型のうえでは
   * 落ちうるものとして扱う（テンプレート側は未定義なら描画しないだけで済む）。
   */
  field: foundry.data.fields.DataField | undefined;
  /** 翻訳済みの表示名 */
  label: string;
  level: number;
  target: number;
  characteristic: CharacteristicKey;
  specialization?: string | undefined;
  mod: ModifierSet;
  isExtra: boolean;
  /** 能力値の表示名。CONFIG.EMOKLORE から引いた翻訳済みの文字列 */
  characteristicLabel: string;
  /** 能力値のFont Awesomeアイコンクラス */
  characteristicIcon: string;
  /** 編集モードの段入力に渡す。フォームの名前と段の並び */
  name: string;
  levelSegments: ValueSegment[];
};

/**
 * label を持つスキーマフィールド。
 *
 * 本体の DataField は label を options から動的に載せており、クラスのプロパティ
 * として宣言していない（common/data/fields.mjs の `_defaults`）。そのため型には
 * 出てこないので、実際に使うメンバーだけを交差型で補う。
 */
export type LabeledField = foundry.data.fields.DataField & { label?: string };

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

/**
 * カスタム技能1行の表示用データ。
 *
 * 組込技能（SkillRow）と違ってスキーマのフィールドを渡さない。編集の出し分けは
 * 「フィールドがあるか」ではなく「選べる能力値が2件以上か」で決まるため。
 */
export type CustomSkillRow = {
  /** 元になる skill アイテムのid。編集・削除・判定はこれで引く */
  id: string;
  /** アイテムの名前をそのまま使う */
  label: string;
  /** 区分の印。ベースは `＊`、エクストラは `★`、通常は空 */
  marker: string;
  level: number;
  target: number;
  isBase: boolean;
  /** 技能ポイントを倍で数えるかの判断に使う。表示側は marker を見る */
  isExtra: boolean;
  /** 能力値の表示名。選べるものが1件のときに出す */
  characteristicLabel: string;
  /** 能力値のFont Awesomeアイコンクラス */
  characteristicIcon: string;
  /** 2件以上あれば選択欄を出す。1件なら表示名だけ */
  characteristicOptions: Array<{ value: string; label: string; selected: boolean }>;
  hasCharacteristicChoice: boolean;
  /**
   * 段入力のラジオをまとめる name。保存しないミラーのパスを指す。
   *
   * 実際の書き込みは selectSegment がアイテムへ回す。フォームに載っても
   * `persisted: false` の枠なので本体が捨てる（保存データには出ない）
   */
  name: string;
  levelSegments: ValueSegment[];
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

/**
 * 武器1行の表示用データ。アイテムタブは読むだけの一覧なので、値はすべて表示用の文字列。
 *
 * 間合いとダメージ式は WeaponDataModel の派生値を翻訳・整形したもの。
 */
export type WeaponRow = {
  id: string;
  name: string;
  img: string;
  /** 射程。近接武器と未記入の遠隔武器は間合いの表示名になる */
  rangeLabel: string;
  /** 「【成功数】D3 ＋ 1D3」形式のダメージ式 */
  damagePreview: string;
};

export type CharacteristicsMap = Record<
  string,
  {
    /** スキーマのフィールド。引けない場合があるのは SkillRow#field と同じ */
    field: foundry.data.fields.DataField | undefined;
    value: number;
    /** 能力値のFont Awesomeアイコンクラス */
    icon: string;
    /** 編集モードの段入力に渡す。フォームの名前と段の並び */
    name: string;
    segments: ValueSegment[];
  }
>;

export type EmokloreActorSheetActions = {
  roll: (event: Event, target: HTMLElement) => Promise<unknown>;
  // mixin側のDEFAULT_OPTIONSから継承チェーン経由でマージされるので、各シートでの宣言は任意
  toggleMode?: (event: Event, target: HTMLElement) => Promise<void>;
};

/**
 * ウィンドウ枠の操作メニュー（⋮）の項目。
 *
 * 本体の ApplicationHeaderControlsEntry のうち、実際に使うメンバーだけを並べている。
 * `ownership` は DocumentSheetV2._getHeaderControls が testUserPermission で絞るのに使う。
 */
export interface EmokloreHeaderControl {
  action: string;
  icon: string;
  label: string;
  ownership?: string;
}

// window / form は mixin 側の DEFAULT_OPTIONS が継承チェーン経由でマージされるため任意
export interface EmokloreActorSheetOptions {
  classes: string[];
  actions: EmokloreActorSheetActions;
  window?: {
    resizable?: boolean;
    controls?: EmokloreHeaderControl[];
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
}

// actions / window / form はサブクラス側で省略できる（mixinのDEFAULT_OPTIONSがマージされるため）
export interface EmokloreDocumentSheetOptions {
  classes: string[];
  actions?: Record<string, (event: Event, target: HTMLElement) => Promise<unknown>>;
  position?: {
    width?: number;
    height?: number;
  };
  window?: {
    resizable?: boolean;
    controls?: EmokloreHeaderControl[];
  };
  form?: {
    submitOnChange: boolean;
  };
}

/**
 * characterシートのコンテキスト。
 *
 * 基底（EmokloreDocumentSheetContext）は継承せず、必要なプロパティを並べ直している。
 * 継承しても型は通るが、`context.charPintSum = 1` のような打ち間違いを捕まえるには
 * 閉じた型のほうが確実で、シート側は全プロパティを明示して代入しているため困らない。
 * `_prepareContext` のキャストは閉じた型のままでも素の as 1つで通る
 * （アサーションの比較可能性は代入可能性より緩いため）。
 */
export type CharacterContext = {
  config: typeof CONFIG.EMOKLORE;
  system: CharacterDataModel;
  // テンプレートが system.emotions も参照するので、紛れないよう emotionRows にしている
  emotionRows: Record<EmotionKey, EmotionRow>;
  emotionOptions: Array<{ value: string; label: string; group: string }>;
  characteristics?: CharacteristicsMap;
  charPointSum?: number;
  charPointMax?: number;
  /** サイドバーを畳んでいるか。トグルの aria-expanded に使う */
  sidebarCollapsed?: boolean;
  skills?: Record<string, SkillRow>;
  baseSkills?: BaseSkillRow[];
  /** 技能リストに並べるカスタム技能（通常・エクストラ、編集モードではベースも） */
  customSkills?: CustomSkillRow[];
  /** 基本技能のチップ列に並べるカスタム技能（ベース区分のみ、閲覧モードだけ） */
  customBaseSkills?: CustomSkillRow[];
  skillPointSum?: number;
  skillPointMax?: number;
  // 経歴は横並びの組（年齢・性別）と、それ以降を分けて渡す
  biographyPairedRows?: BiographyRow[];
  biographyRows?: BiographyRow[];
  tabs: Record<string, ApplicationTab>;
  tab?: unknown;
  weapons?: WeaponRow[];
  effects?: ReturnType<typeof import("../utils/effects").prepareActiveEffectCategories>;
  // 基底の EmokloreDocumentSheetContext と対応する分
  isPlay: boolean;
  owner: boolean;
  limited: boolean;
  gm: boolean;
  document: EmokloreActor;
  systemFields: Record<string, foundry.data.fields.DataField>;
  flags: Record<string, unknown>;
};

/**
 * カスタム技能シートのコンテキスト。
 *
 * CharacterContext と同じく、基底は継承せず必要なものを並べ直している（理由は上を参照）。
 */
export type SkillContext = {
  system: SkillDataModel;
  /** 区分の翻訳済み表示名。「ベース技能」「通常技能」「エクストラ技能」 */
  categoryLabel: string;
  /** 参照能力値。複数あるものは「身体／器用」 */
  characteristicLabel: string;
  /** 技能グループの翻訳済み表示名。所属しなければ「なし」 */
  groupLabel: string;
  /** レベルの行を出すか。ベース技能はレベルを持たないので出さない */
  showLevel: boolean;
  /** enrichHTML 済みの備考 */
  notesHTML: string;
  isPlay: boolean;
  owner: boolean;
  limited: boolean;
  gm: boolean;
  document: EmokloreItem;
  systemFields: Record<string, foundry.data.fields.DataField>;
  flags: Record<string, unknown>;
};

/**
 * 防具シートのコンテキスト。
 *
 * CharacterContext と同じく、基底は継承せず必要なものを並べ直している（理由は上を参照）。
 */
export type ArmorContext = {
  system: ArmorDataModel;
  /** 適用条件の行を閲覧で出すか。未記入なら出さない */
  showCoverage: boolean;
  /** enrichHTML 済みの備考 */
  notesHTML: string;
  isPlay: boolean;
  owner: boolean;
  limited: boolean;
  gm: boolean;
  document: EmokloreItem;
  systemFields: Record<string, foundry.data.fields.DataField>;
  flags: Record<string, unknown>;
};

/**
 * 武器シートのコンテキスト。
 *
 * CharacterContext と同じく、基底は継承せず必要なものを並べ直している（理由は上を参照）。
 */
export type WeaponContext = {
  system: WeaponDataModel;
  /** 参照技能の翻訳済み表示名 */
  attackSkillLabel: string;
  /** 間合いの翻訳済み表示名。「近接」「遠隔」 */
  rangeTypeLabel: string;
  /** 射程の行を閲覧で出すか。近接武器と未記入の遠隔武器では間合いと重複するので出さない */
  showRange: boolean;
  /** 「【成功数】D3 ＋ 1D3」形式のダメージ式 */
  damagePreview: string;
  /** enrichHTML 済みの備考 */
  notesHTML: string;
  isPlay: boolean;
  owner: boolean;
  limited: boolean;
  gm: boolean;
  document: EmokloreItem;
  systemFields: Record<string, foundry.data.fields.DataField>;
  flags: Record<string, unknown>;
};
