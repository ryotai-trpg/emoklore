import * as applications from "./module/applications/character-sheet";
import { EMOKLORE } from "./module/config/index";
import { systemID } from "./module/constants";
import { CharacterDataModel } from "./module/data/character";
import { WeaponDataModel } from "./module/data/item-models";
import { NpcDataModel } from "./module/data/npc";
import { EmokloreDie } from "./module/dice/emoklore-die";
// import { EmokloreRollParser } from './module/dice/emoklore-parser';
import { EmokloreRoll } from "./module/dice/emoklore-roll";
import { EmokloreActor } from "./module/documents/actor";
import { EmokloreItem } from "./module/documents/item";
import { registerSystemSettings } from "./module/settings";
import { performPreLocalization } from "./module/utils/localization";

Hooks.once("init", () => {
  console.log("Emo-klore TRPG | Initializing...");

  CONFIG.EMOKLORE = EMOKLORE;

  registerSystemSettings();

  // Configure custom Document implementations.
  (CONFIG as any).Actor.documentClass = EmokloreActor;
  (CONFIG as any).Item.documentClass = EmokloreItem;

  // Configure System Data Models.
  (CONFIG as any).Actor.dataModels = {
    character: CharacterDataModel,
    npc: NpcDataModel,
  };
  (CONFIG as any).Item.dataModels = {
    weapon: WeaponDataModel,
  };

  // CONFIG.Dice.parser = EmokloreRollParser;
  (CONFIG as any).Dice.rolls.push(EmokloreRoll);
  (CONFIG as any).Dice.terms.d = EmokloreDie;

  // Configure trackable attributes.
  // TODO: Not Translated
  (CONFIG as any).Actor.trackableAttributes = {
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
  // DocumentSheetConfig.unregisterSheet(Actor, "core", foundry.appv1.sheets.ActorSheet);

  DocumentSheetConfig.registerSheet(Actor, "emoklore", applications.EmokloreCharacterSheet as any, {
    types: ["character"],
    makeDefault: true,
    label: "EMOKLORE.SheetClass.character",
  });
});
Hooks.once("i18nInit", () => {
  // CONFIG.EMOKLORE のラベル（i18nキー）をその場で翻訳文字列に置き換える。
  // スキーマのラベルは LOCALIZATION_PREFIXES 経由で本体が処理するため、ここでは触らない
  performPreLocalization(CONFIG.EMOKLORE as unknown as Record<string, unknown>);
});

Hooks.once("ready", () => {
  if (game.settings.get(systemID as any, "developerMode" as any)) {
    (game.actors as any).get("IqCtJnUqjTsjXqss").sheet.render(true);
  }
});
