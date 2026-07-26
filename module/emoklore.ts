// このimportがビルド時のCSS出力のトリガになる。外すと dist/emoklore.css が
// 生成されず、system.json の styles が指す先がなくなる（型の宣言は types/css.d.ts）
import "../css/emoklore.css";
import { api } from "./api";
import { EmokloreActiveEffectConfig } from "./applications/active-effect-config";
import { EmokloreArmorSheet } from "./applications/armor-sheet";
import { EmokloreCharacterSheet } from "./applications/character-sheet";
import { injectChatControls } from "./applications/chat-controls";
import { EmokloreCombatTracker } from "./applications/combat-tracker";
import { applyHowling, drawHowling } from "./applications/howling";
import { EmokloreHowlingSheet } from "./applications/howling-sheet";
import { applyKaiDamage } from "./applications/kai-attack";
import { EmokloreKaiSheet } from "./applications/kai-sheet";
import { EmokloreNpcSheet } from "./applications/npc-sheet";
import { rollRequested, rollRequestedResonance } from "./applications/requests";
import { EmokloreSkillSheet } from "./applications/skill-sheet";
import {
  applyDamage,
  applyDamageWithReduction,
  rollAttack,
  rollDamage,
} from "./applications/weapon-card";
import { EmokloreWeaponSheet } from "./applications/weapon-sheet";
import { EMOKLORE } from "./config/index";
import { statusEffects } from "./config/status-effects";
import { SYSTEM_ID } from "./constants";
import { CharacterDataModel } from "./data/character";
import { CombatDataModel } from "./data/combat";
import {
  ArmorDataModel,
  HowlingDataModel,
  SkillDataModel,
  WeaponDataModel,
} from "./data/item-models";
import { KaiDataModel } from "./data/kai";
import { DamageAppliedModel } from "./data/messages/damage-applied";
import { HowlingDrawModel } from "./data/messages/howling-draw";
import { KaiAttackCardModel } from "./data/messages/kai-attack-card";
import { ResonanceOutcomeModel } from "./data/messages/resonance-outcome";
import { ResonanceRequestModel } from "./data/messages/resonance-request";
import { SkillRequestModel } from "./data/messages/skill-request";
import { SurvivalReminderModel } from "./data/messages/survival-reminder";
import { WeaponCardModel } from "./data/messages/weapon-card";
import { NpcDataModel } from "./data/npc";
import { EmokloreDie } from "./dice/emoklore-die";
import { EmokloreRoll } from "./dice/emoklore-roll";
import { EmokloreActor } from "./documents/actor";
import { EmokloreCombat } from "./documents/combat";
import { EmokloreCombatant } from "./documents/combatant";
import { EmokloreItem } from "./documents/item";
import { registerQueries } from "./documents/queries";
import { getSetting, registerSystemSettings } from "./settings";
import { performPreLocalization } from "./utils/localization";
import { typedEntries } from "./utils/object";

type RegisterSheetArgs = Parameters<
  typeof foundry.applications.apps.DocumentSheetConfig.registerSheet
>;

/**
 * シートを1種類登録する。
 *
 * 本体は第3引数に `typeof ApplicationV2` を要求するが、`HandlebarsApplicationMixin` を
 * 通したサブクラスはコンストラクタ型のジェネリクスが開いたままで代入互換にならない。
 * 8種類ぶん同じキャストを並べずに済むよう、名乗り直しをここ1箇所に閉じる。
 *
 * 実行時に本体が見るのは `sheetClass.name` と、`DocumentSheetV2` のサブクラスかどうか
 * だけなので（`client/applications/apps/document-sheet-config.mjs`）、受けるのは構造で足りる。
 *
 * `scope` と `makeDefault` は全種で同じ値になるため引数に出さない。
 */
const registerSheet = (
  documentClass: RegisterSheetArgs[0],
  sheetClass: { name: string; prototype: unknown },
  options: { label: string; types?: string[] },
) => {
  foundry.applications.apps.DocumentSheetConfig.registerSheet(
    documentClass,
    SYSTEM_ID,
    sheetClass as RegisterSheetArgs[2],
    { makeDefault: true, ...options },
  );
};

Hooks.once("init", () => {
  console.log("Emo-klore TRPG | Initializing...");

  CONFIG.EMOKLORE = EMOKLORE;

  // マクロとモジュールから呼べる口。中身は module/api.ts が決める
  game.system.api = api;

  registerSystemSettings();

  // 権限の無いアクターへのダメージ適用をGMに肩代わりしてもらうための受け口
  registerQueries();

  // Documentの実装クラスを差し替える
  CONFIG.Actor.documentClass = EmokloreActor;
  CONFIG.Item.documentClass = EmokloreItem;
  CONFIG.Combat.documentClass = EmokloreCombat;
  CONFIG.Combatant.documentClass = EmokloreCombatant;

  // system配下のデータモデルを登録する。
  // TypeDataModel のコンストラクタ型はジェネリクスが開いたままなので、ModelData を
  // 固定したサブクラスは代入互換にならない。登録先の型として明示する
  //
  // 種別と system.json の documentTypes は必ず揃える。作成できない種別を登録すると
  // EmokloreActor#system の型が嘘になる（片方だけ足すと到達不能な種別が生まれる）
  CONFIG.Actor.dataModels = {
    character: CharacterDataModel,
    npc: NpcDataModel,
    kai: KaiDataModel,
  } as typeof CONFIG.Actor.dataModels;
  CONFIG.Item.dataModels = {
    weapon: WeaponDataModel,
    armor: ArmorDataModel,
    skill: SkillDataModel,
    howling: HowlingDataModel,
  } as typeof CONFIG.Item.dataModels;
  CONFIG.ChatMessage.dataModels = {
    weapon: WeaponCardModel,
    kaiAttack: KaiAttackCardModel,
    damageApplied: DamageAppliedModel,
    survivalReminder: SurvivalReminderModel,
    skillRequest: SkillRequestModel,
    resonanceRequest: ResonanceRequestModel,
    resonanceOutcome: ResonanceOutcomeModel,
    howlingDraw: HowlingDrawModel,
  } as typeof CONFIG.ChatMessage.dataModels;
  // Combat は単一種別 standard。エンカウンターのイニシアチブ基準を system に持たせる
  CONFIG.Combat.dataModels = {
    standard: CombatDataModel,
  } as typeof CONFIG.Combat.dataModels;

  // イニシアチブは能力値＋技能の整数。小数点以下は出さない。同値のタイブレークはトラッカーの
  // 相対入力（+2 / =5）で手動調整するので、整数のまま直接編集できる状態を保つ
  CONFIG.Combat.initiative.decimals = 0;

  // 基準（能力値＋技能）の選択バーをトラッカーに後付けする
  CONFIG.ui.combat = EmokloreCombatTracker;

  CONFIG.Dice.rolls.push(EmokloreRoll);
  CONFIG.Dice.terms.d = EmokloreDie;

  // カードのボタンはすべて applications/ 側にハンドラを置き、モジュールにも開いている
  // ACTIONS の口から登録する。data/ から documents/ への逆依存を作らないため
  WeaponCardModel.ACTIONS.rollAttack = rollAttack;
  WeaponCardModel.ACTIONS.rollDamage = rollDamage;
  WeaponCardModel.ACTIONS.applyDamage = applyDamage;
  WeaponCardModel.ACTIONS.applyDamageWithReduction = applyDamageWithReduction;

  // 怪異の攻撃カードの「ダメージ適用」
  KaiAttackCardModel.ACTIONS.applyDamage = applyKaiDamage;

  // DLからの判定要求。押した人のアクターで振るので、これも applications/ 側から登録する
  SkillRequestModel.ACTIONS.rollRequested = rollRequested;
  ResonanceRequestModel.ACTIONS.rollResonance = rollRequestedResonance;

  // ハウリング。共鳴結果カードから表を引き、引いた結果カードから反応を共鳴者に乗せる
  ResonanceOutcomeModel.ACTIONS.drawHowling = drawHowling;
  HowlingDrawModel.ACTIONS.applyHowling = applyHowling;

  // トークンに付けられる状態をエモクロアのものに差し替える。既定はD&D風の
  // dead/blind/prone… で、ルールブックの【気絶】【心肺停止】などが1つも無い。
  //
  // 配列ごと代入せず1件ずつ出し入れするのは、v14の CONFIG.statusEffects が
  // 添字とidの両方で引けるProxyだから。代入すると素の配列に戻り、本体が使う
  // CONFIG.statusEffects[statusId] の形（fromStatusEffect など）が通らなくなる。
  // idでの読み書きはProxyのtrapが配列側にも反映してくれるので、これで両立する
  for (const id of Object.keys(CONFIG.statusEffects)) delete CONFIG.statusEffects[id];
  for (const [id, config] of typedEntries(statusEffects)) {
    CONFIG.statusEffects[id] = { id, ...config };
  }

  // 「撃破」として扱う状態。既定値も "dead" だが、キー名がたまたま一致している
  // ことに頼らず明示する。残りの specialStatusEffects（invisible / blind /
  // burrow / hover / fly）は本体の視界・探知が使うので既定のままにする
  CONFIG.specialStatusEffects.DEFEATED = "dead";

  // トークンのリソースバーに出せる属性
  CONFIG.Actor.trackableAttributes = {
    character: {
      bar: ["resources.hp", "resources.mp", "resources.resonance"],
      value: [],
    },
    // 人間NPCは共鳴値を持たないので HP/MP のみ
    npc: {
      bar: ["resources.hp", "resources.mp"],
      value: [],
    },
    // 怪異は HP/MP をバーに、装甲は減らない固定値なので value に出す
    kai: {
      bar: ["resources.hp", "resources.mp"],
      value: ["resources.armor"],
    },
  };

  registerSheet(Actor, EmokloreCharacterSheet, {
    types: ["character"],
    label: "EMOKLORE.Sheet.class.character",
  });
  registerSheet(Actor, EmokloreNpcSheet, {
    types: ["npc"],
    label: "EMOKLORE.Sheet.class.npc",
  });
  registerSheet(Actor, EmokloreKaiSheet, {
    types: ["kai"],
    label: "EMOKLORE.Sheet.class.kai",
  });

  registerSheet(Item, EmokloreWeaponSheet, {
    types: ["weapon"],
    label: "EMOKLORE.Sheet.class.weapon",
  });
  registerSheet(Item, EmokloreArmorSheet, {
    types: ["armor"],
    label: "EMOKLORE.Sheet.class.armor",
  });
  registerSheet(Item, EmokloreSkillSheet, {
    types: ["skill"],
    label: "EMOKLORE.Sheet.class.skill",
  });
  registerSheet(Item, EmokloreHowlingSheet, {
    types: ["howling"],
    label: "EMOKLORE.Sheet.class.howling",
  });

  // 効果の設定シート。属性キーを手打ちさせないための差し替えで、種別は base 一択
  registerSheet(ActiveEffect, EmokloreActiveEffectConfig, {
    label: "EMOKLORE.Sheet.class.activeEffect",
  });
});
// チャットカードのボタンを繋ぐ。本体のチャットログは自前のアクション表しか見ないので、
// システム側のボタンはメッセージが描かれるたびに自分で拾う必要がある
Hooks.on("renderChatMessageHTML", (message: ChatMessage, html: HTMLElement) => {
  const system = (message as { system?: { addListeners?: (html: HTMLElement) => void } }).system;
  system?.addListeners?.(html);
});

// チャット欄にDL用のボタンを差す。v14は入力欄まわりの要素をこのフックで渡してくる
Hooks.on("renderChatInput", (_chat: unknown, elements: Record<string, HTMLElement>) => {
  injectChatControls(elements);
});

Hooks.once("i18nInit", () => {
  // CONFIG.EMOKLORE のラベル（i18nキー）をその場で翻訳文字列に置き換える。
  // スキーマのラベルは LOCALIZATION_PREFIXES 経由で本体が処理するため、ここでは触らない
  // biome-ignore lint: CONFIG.EMOKLORE は具体型なので汎用の Record へは素の as では通らない
  performPreLocalization(CONFIG.EMOKLORE as unknown as Record<string, unknown>);
});

// 開発時に決まったアクターのシートを自動で開くための仕込み。
// 対象は設定（developerActorId）で指定する
Hooks.once("ready", () => {
  if (!getSetting("developerMode")) return;

  const actorId = getSetting("developerActorId");
  if (!actorId) return;

  // CONFIG.Actor.documentClass に EmokloreActor を登録しているが、コレクションの型は基底のまま
  const actor = game.actors.get(actorId) as EmokloreActor | undefined;
  if (!actor) {
    console.warn(`emoklore | developerActorId のアクターが見つかりません: ${actorId}`);
    return;
  }

  actor.sheet?.render(true);
});
