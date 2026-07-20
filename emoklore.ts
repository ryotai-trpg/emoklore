import * as applications from "./module/applications/character-sheet";
import { EmokloreWeaponSheet } from "./module/applications/weapon-sheet";
import { EMOKLORE } from "./module/config/index";
import { CharacterDataModel } from "./module/data/character";
import { WeaponDataModel } from "./module/data/item-models";
import { WeaponCardModel } from "./module/data/messages/weapon-card";
import { NpcDataModel } from "./module/data/npc";
import { EmokloreDie } from "./module/dice/emoklore-die";
import { EmokloreRoll } from "./module/dice/emoklore-roll";
import { EmokloreActor } from "./module/documents/actor";
import { EmokloreItem } from "./module/documents/item";
import { getSetting, registerSystemSettings } from "./module/settings";
import { performPreLocalization } from "./module/utils/localization";

Hooks.once("init", () => {
  console.log("Emo-klore TRPG | Initializing...");

  CONFIG.EMOKLORE = EMOKLORE;

  registerSystemSettings();

  // Documentの実装クラスを差し替える
  CONFIG.Actor.documentClass = EmokloreActor;
  CONFIG.Item.documentClass = EmokloreItem;

  // system配下のデータモデルを登録する
  // TypeDataModel のコンストラクタ型はジェネリクスが開いたままなので、ModelData を
  // 固定したサブクラスは代入互換にならない。登録先の型として明示する
  CONFIG.Actor.dataModels = {
    character: CharacterDataModel,
    npc: NpcDataModel,
  } as typeof CONFIG.Actor.dataModels;
  CONFIG.Item.dataModels = {
    weapon: WeaponDataModel,
  } as typeof CONFIG.Item.dataModels;
  CONFIG.ChatMessage.dataModels = {
    weapon: WeaponCardModel,
  } as typeof CONFIG.ChatMessage.dataModels;

  CONFIG.Dice.rolls.push(EmokloreRoll);
  CONFIG.Dice.terms.d = EmokloreDie;

  // トークンのリソースバーに出せる属性
  CONFIG.Actor.trackableAttributes = {
    character: {
      bar: ["resources.hp", "resources.mp", "resources.resonance"],
      value: [],
    },
    npc: {
      bar: ["resources.hp", "resources.mp"],
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
      label: "EMOKLORE.SheetClass.character",
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
      label: "EMOKLORE.SheetClass.weapon",
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
