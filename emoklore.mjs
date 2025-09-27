import { EMOKLORE } from "./module/config.mjs";
import { EmokloreActor, EmokloreItem } from "./module/documents.mjs";
import { CharacterDataModel, NpcDataModel, PawnDataModel, WeaponDataModel, SpellDataModel } from "./module/data-models.mjs";
import * as applications from "./module/sheet.mjs"

Hooks.once("init", () => {
  console.log("emoklore init")

  CONFIG.EMOKLORE = EMOKLORE

  // Configure custom Document implementations.
  CONFIG.Actor.documentClass = EmokloreActor;
  CONFIG.Item.documentClass = EmokloreItem;

  // Configure System Data Models.
  CONFIG.Actor.dataModels = {
    character: CharacterDataModel,
    npc: NpcDataModel,
    pawn: PawnDataModel
  };
  CONFIG.Item.dataModels = {
    weapon: WeaponDataModel,
    spell: SpellDataModel
  };

  // Configure trackable attributes.
  CONFIG.Actor.trackableAttributes = {
    character: {
      bar: ["resources.health", "resources.power", "goodness"],
      value: ["progress"]
    },
    npc: {
      bar: ["resources.health", "resources.power"],
      value: []
    }
  };

  const DocumentSheetConfig = foundry.applications.apps.DocumentSheetConfig;
  // DocumentSheetConfig.unregisterSheet(Actor, "core", foundry.appv1.sheets.ActorSheet);

  DocumentSheetConfig.registerSheet(Actor, "emoklore", applications.EmokloreActorSheet, {
    types: ["character"],
    makeDefault: true,
    label: "EMOKLORE.SheetClass.character"
  });
});
