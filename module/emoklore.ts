// このimportがビルド時のCSS出力のトリガになる。外すと dist/emoklore.css が
// 生成されず、system.json の styles が指す先がなくなる（型の宣言は types/css.d.ts）
import "../css/emoklore.css";
import { EmokloreActiveEffectConfig } from "./applications/active-effect-config";
import * as applications from "./applications/character-sheet";
import { EmokloreSkillSheet } from "./applications/skill-sheet";
import { EmokloreWeaponSheet } from "./applications/weapon-sheet";
import { EMOKLORE } from "./config/index";
import { statusEffects } from "./config/status-effects";
import { CharacterDataModel } from "./data/character";
import { SkillDataModel, WeaponDataModel } from "./data/item-models";
import { WeaponCardModel } from "./data/messages/weapon-card";
import { EmokloreDie } from "./dice/emoklore-die";
import { EmokloreRoll } from "./dice/emoklore-roll";
import { EmokloreActor } from "./documents/actor";
import { EmokloreItem } from "./documents/item";
import { registerQueries } from "./documents/queries";
import { getSetting, registerSystemSettings } from "./settings";
import { performPreLocalization } from "./utils/localization";
import { typedEntries } from "./utils/object";

Hooks.once("init", () => {
  console.log("Emo-klore TRPG | Initializing...");

  CONFIG.EMOKLORE = EMOKLORE;

  registerSystemSettings();

  // 権限の無いアクターへのダメージ適用をGMに肩代わりしてもらうための受け口
  registerQueries();

  // Documentの実装クラスを差し替える
  CONFIG.Actor.documentClass = EmokloreActor;
  CONFIG.Item.documentClass = EmokloreItem;

  // system配下のデータモデルを登録する。
  // TypeDataModel のコンストラクタ型はジェネリクスが開いたままなので、ModelData を
  // 固定したサブクラスは代入互換にならない。登録先の型として明示する
  //
  // npc は system.json の documentTypes に無く作成できないため登録しない。登録だけ
  // 残すと EmokloreActor#system の型（CharacterDataModel）が嘘になる。
  // NPCシートを実装する Phase 3 で、判定まわりの扱いごと決めて戻す
  CONFIG.Actor.dataModels = {
    character: CharacterDataModel,
  } as typeof CONFIG.Actor.dataModels;
  CONFIG.Item.dataModels = {
    weapon: WeaponDataModel,
    skill: SkillDataModel,
  } as typeof CONFIG.Item.dataModels;
  CONFIG.ChatMessage.dataModels = {
    weapon: WeaponCardModel,
  } as typeof CONFIG.ChatMessage.dataModels;

  CONFIG.Dice.rolls.push(EmokloreRoll);
  CONFIG.Dice.terms.d = EmokloreDie;

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
  };

  const DocumentSheetConfig = foundry.applications.apps.DocumentSheetConfig;

  // ApplicationV2 のコンストラクタ型はジェネリクスが開いたままなので、
  // 具体化したサブクラスは代入互換にならない。登録先が期待する型として明示する
  DocumentSheetConfig.registerSheet(
    Actor,
    "emoklore",
    // biome-ignore lint: 本体のコンストラクタ型がジェネリクス開放のため素の as では通らない
    applications.EmokloreCharacterSheet as unknown as typeof foundry.applications.api.ApplicationV2,
    {
      types: ["character"],
      makeDefault: true,
      label: "EMOKLORE.Sheet.class.character",
    },
  );

  DocumentSheetConfig.registerSheet(
    Item,
    "emoklore",
    // biome-ignore lint: 本体のコンストラクタ型がジェネリクス開放のため素の as では通らない
    EmokloreWeaponSheet as unknown as typeof foundry.applications.api.ApplicationV2,
    {
      types: ["weapon"],
      makeDefault: true,
      label: "EMOKLORE.Sheet.class.weapon",
    },
  );

  DocumentSheetConfig.registerSheet(
    Item,
    "emoklore",
    // biome-ignore lint: 本体のコンストラクタ型がジェネリクス開放のため素の as では通らない
    EmokloreSkillSheet as unknown as typeof foundry.applications.api.ApplicationV2,
    {
      types: ["skill"],
      makeDefault: true,
      label: "EMOKLORE.Sheet.class.skill",
    },
  );

  // 効果の設定シート。属性キーを手打ちさせないための差し替えで、種別は base 一択
  DocumentSheetConfig.registerSheet(
    ActiveEffect,
    "emoklore",
    // biome-ignore lint: 本体のコンストラクタ型がジェネリクス開放のため素の as では通らない
    EmokloreActiveEffectConfig as unknown as typeof foundry.applications.api.ApplicationV2,
    {
      makeDefault: true,
      label: "EMOKLORE.Sheet.class.activeEffect",
    },
  );
});
// チャットカードのボタンを繋ぐ。本体のチャットログは自前のアクション表しか見ないので、
// システム側のボタンはメッセージが描かれるたびに自分で拾う必要がある
Hooks.on("renderChatMessageHTML", (message: ChatMessage, html: HTMLElement) => {
  const system = (message as { system?: { addListeners?: (html: HTMLElement) => void } }).system;
  system?.addListeners?.(html);
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
