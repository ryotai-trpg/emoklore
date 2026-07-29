import type { ApplicationRenderContext, ApplicationTab } from "@client/applications/_types.mjs";
import type { HandlebarsRenderOptions } from "@client/applications/api/handlebars-application.mjs";
import type { SchemaField } from "@common/data/fields.mjs";
import type { CharacterDataModel } from "../data/character";
import type {
  ArmorDataModel,
  HowlingDataModel,
  SkillDataModel,
  WeaponDataModel,
} from "../data/item-models";
import type { KaiDataModel } from "../data/kai";
import type { NpcDataModel } from "../data/npc";
import type { EmokloreActor } from "../documents/actor";
import type { EmokloreItem } from "../documents/item";
import type { ModifierSet } from "../rules/types";
import type { HowlingRow } from "../utils/howling";
import type { SkillDisplay, SkillLabel } from "../utils/skill";
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

/**
 * 技能1行の表示用データ。保存値と、技能の見せ方（`describeSkill`）を合流させたもの。
 *
 * 名前まわり（label / marker / 能力値のラベルとアイコン）は `SkillDisplay` が持つ。
 * ここに書き足すのは、その技能のアクター側の値と、入力に要るものだけ。
 */
export type SkillRow = SkillDisplay & {
  /**
   * スキーマのフィールド。編集モードで formInput に渡す。
   *
   * `schema.getField()` は見つからなければ undefined を返す。スキーマは
   * CONFIG.EMOKLORE と同じキー集合から作るので実際には引けるが、型のうえでは
   * 落ちうるものとして扱う（テンプレート側は未定義なら描画しないだけで済む）。
   */
  field: foundry.data.fields.DataField | undefined;
  level: number;
  target: number;
  specialization?: string | undefined;
  mod: ModifierSet;
  isExtra: boolean;
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
export type CustomSkillRow = SkillDisplay & {
  /** 元になる skill アイテムのid。編集・削除・判定はこれで引く */
  id: string;
  level: number;
  target: number;
  isBase: boolean;
  /** 技能ポイントを倍で数えるかの判断に使う。表示側は marker を見る */
  isExtra: boolean;
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
export type BaseSkillRow = SkillDisplay & {
  key: string;
  target: number;
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
  equipped: boolean;
};

/** 防具1行の表示用データ。武器と同じく読むだけの一覧で、装備トグルだけが書ける */
export type ArmorRow = {
  id: string;
  name: string;
  img: string;
  defense: number;
  coverage: string;
  equipped: boolean;
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
  // 行の埋め込みドキュメント（アイテム・効果）の開く・作る・消す。どのアクターシートも
  // 同じ操作なので基底が持ち、マークアップに data-action がある種別だけで実際に発火する
  viewDoc: (event: Event, target: HTMLElement) => Promise<void>;
  createDoc: (event: Event, target: HTMLElement) => Promise<void>;
  deleteDoc: (event: Event, target: HTMLElement) => Promise<void>;
  // 効果・装備のトグル、技能の段入力と作成。行操作と同じく基底が持ち、
  // マークアップに data-action がある種別だけで実際に発火する
  toggleEffect: (event: Event, target: HTMLElement) => Promise<void>;
  toggleEquipped: (event: Event, target: HTMLElement) => Promise<void>;
  selectSegment: (event: Event, target: HTMLElement) => Promise<void>;
  createSkill: (event: Event, target: HTMLElement) => Promise<void>;
  // mixin側のDEFAULT_OPTIONSから継承チェーン経由でマージされるので、各シートでの宣言は任意
  toggleMode?: (event: Event, target: HTMLElement) => Promise<void>;
};

/**
 * 行の右クリックメニューの項目。
 *
 * 本体の ContextMenuEntry のうち実際に使うものだけ。**綴りは v14 のもの**で、
 * `name` / `condition` / `callback` は非推奨（`ux/context-menu.mjs`）。`label` は
 * 本体が `_loc` を通すのでキーをそのまま入れる。
 */
export interface RowContextEntry {
  label: string;
  icon: string;
  /** メニューを開くたびに評価される */
  visible?: () => boolean;
  onClick: (event: PointerEvent, target: HTMLElement) => void;
}

/**
 * 並び替えの対象になる ActiveEffect。
 *
 * `parent` / `sort` はスキーマとClientDocumentMixin由来で、本体JSDocの型に出てこない。
 * 使う分だけ交差型で足す（`utils/effects.ts` の SheetActiveEffect と同じ扱い）。
 */
export type SheetEffect = ActiveEffect & { parent: unknown; sort: number };

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
 * どのシートのコンテキストも共通で持つもの。
 *
 * **基底（`EmokloreDocumentSheetContext`）は継承しない。** あちらは
 * `ApplicationRenderContext` 由来の `[key: string]: unknown` を引き継ぐので、
 * `context.charPintSum = 1` のような打ち間違いが型チェックを素通りする（実測で確認済み）。
 * 交差型には index signature が入らないため、この形なら閉じたまま共有できる。
 */
export type SheetContextBase<D, S> = {
  isPlay: boolean;
  owner: boolean;
  limited: boolean;
  gm: boolean;
  document: D;
  system: S;
  systemFields: Record<string, foundry.data.fields.DataField>;
  flags: Record<string, unknown>;
};

/**
 * characterシートのコンテキスト。
 *
 * `_prepareContext` のキャストは閉じた型のままでも素の as 1つで通る
 * （アサーションの比較可能性は代入可能性より緩いため）。
 */
export type CharacterContext = SheetContextBase<EmokloreActor, CharacterDataModel> & {
  config: typeof CONFIG.EMOKLORE;
  // テンプレートが system.emotions も参照するので、紛れないよう emotionRows にしている
  emotionRows: Record<EmotionKey, EmotionRow>;
  /** 追加取得した共鳴感情。枚数が決まらないので配列 */
  acquiredEmotionRows: EmotionRow[];
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
  armors?: ArmorRow[];
  effects?: ReturnType<typeof import("../utils/effects").prepareActiveEffectCategories>;
  /** いま受けているハウリング反応。効果タブの専用区分に並ぶ */
  howlings?: HowlingRow[];
};

/**
 * カスタム技能シートのコンテキスト。
 *
 * 共通の8項目は SheetContextBase が持つ（理由はそちらを参照）。
 */
export type SkillContext = SheetContextBase<EmokloreItem, SkillDataModel> & {
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
};

/**
 * 防具シートのコンテキスト。
 *
 * 共通の8項目は SheetContextBase が持つ（理由はそちらを参照）。
 */
export type ArmorContext = SheetContextBase<EmokloreItem, ArmorDataModel> & {
  /** 適用条件の行を閲覧で出すか。未記入なら出さない */
  showCoverage: boolean;
  /** enrichHTML 済みの備考 */
  notesHTML: string;
};

/**
 * ハウリング反応シートのコンテキスト。
 *
 * 共通の8項目は SheetContextBase が持つ（理由はそちらを参照）。
 */
export type HowlingContext = SheetContextBase<EmokloreItem, HowlingDataModel> & {
  /** 分類の翻訳済み表示名。「反射」「同調」など */
  categoryLabel: string;
  /** 回復判定に使う技能の並び。「＊自我／心理」。指定が無ければ空文字 */
  recoverySkillLabel: string;
  /** enrichHTML 済みの効果 */
  effectHTML: string;
  /** enrichHTML 済みのフレーバー */
  notesHTML: string;
};

/**
 * 武器シートのコンテキスト。
 *
 * 共通の8項目は SheetContextBase が持つ（理由はそちらを参照）。
 */
export type WeaponContext = SheetContextBase<EmokloreItem, WeaponDataModel> & {
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
};

/** 人間NPCシートの技能1行。共鳴者シートと違い、組込技能にも区分の印を出す */
export type NpcSkillRow = SkillDisplay & {
  key: string;
  /** シートの `data-roll-type` の値 */
  rollType: string;
  level: number;
  target: number;
  /** レベル入力のスキーマフィールド。基本技能はレベルを編集できないので持たない */
  field?: foundry.data.fields.DataField | undefined;
  /** 閲覧モードに並べるか。基本技能だけが持つ（`shownBaseSkills`） */
  shown?: boolean;
};

/**
 * 人間NPCシートのコンテキスト。
 *
 * 共通の8項目は SheetContextBase が持つ（理由はそちらを参照）。
 */
export type NpcSheetContext = SheetContextBase<EmokloreActor, NpcDataModel> & {
  characteristics: Array<{
    key: string;
    label: string;
    icon: string;
    value: number;
    /** 入力のスキーマフィールド。min / max はここから来る（SkillRow#field と同じ扱い） */
    field: foundry.data.fields.DataField | undefined;
  }>;
  skills: NpcSkillRow[];
  /** 閲覧モードでは `shownBaseSkills` に選ばれたものだけ。編集モードは13件すべて */
  baseSkills: NpcSkillRow[];
  /** カスタム技能は判定に要る分だけ。能力値は列に出さないので SkillLabel で足りる */
  customSkills: Array<SkillLabel & { id: string; level: number; target: number }>;
  /** 装備の概念を持たないので、共鳴者の武器行から equipped を落としたもの */
  weapons: Array<Omit<WeaponRow, "equipped">>;
};

/**
 * 怪異シートのコンテキスト。
 *
 * 共通の8項目は SheetContextBase が持つ（理由はそちらを参照）。
 */
export type KaiSheetContext = SheetContextBase<EmokloreActor, KaiDataModel> & {
  /** 「感情（属性）」の並び。属性順に整えたもの */
  selectedEmotions: Array<{ key: string; label: string }>;
  /** enrichHTML 済みの憑依変異 */
  mutationHTML: string;
  /** 共鳴表への @UUID リンク。参照が無ければ空文字 */
  resonanceTableLink: string;
  /**
   * 攻撃1件ぶんのフィールド。ラベルとプレースホルダを引くために積む。
   *
   * `attacks` は ArrayField なので、要素のフィールドは
   * `systemFields.attacks.element.fields` に居る（本体は要素の `name` を
   * "element" に固定する）。テンプレートから毎回この道を辿ると読めないので、
   * コンテキスト側で解決しておく
   */
  attackFields: SchemaField["fields"];
};
