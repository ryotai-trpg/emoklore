import { EMOKLORE } from "./module/config/index";
import { systemID } from "./module/constants";

import { EmokloreActor } from "./module/documents/actor";
import { EmokloreItem } from "./module/documents/item";

import { WeaponDataModel } from "./module/data/item-models";
import { CharacterDataModel } from "./module/data/character";
import { NpcDataModel } from "./module/data/npc";

import * as applications from "./module/sheets/character-sheet";
import { EmokloreWeaponSheet } from "./module/sheets/weapon-sheet";

import { performPreLocalization } from "./module/helpers/localization";

import { EmokloreDie } from './module/dice/emoklore-die';
// import { EmokloreRollParser } from './module/dice/emoklore-parser';
import { EmokloreRoll } from "./module/dice/emoklore-roll";
import { registerSystemSettings } from "./module/settings";
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
  (CONFIG as any).Dice.terms["d"] = EmokloreDie;

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

  DocumentSheetConfig.registerSheet(Item, "emoklore", EmokloreWeaponSheet as any, {
    types: ["weapon"],
    makeDefault: true,
    label: "EMOKLORE.SheetClass.weapon",
  });
});
Hooks.once("i18nInit", () => {
  performPreLocalization(CONFIG.EMOKLORE as unknown as Record<string, unknown>);

  // These fields are not auto-localized due to having a different location in ja.json
  for (const model of Object.values((CONFIG as any).Actor.dataModels)) {
    /** @type {foundry.data.fields.SchemaField} */
    const characteristicSchema = (model as any).schema.getField("characteristics");
    if (characteristicSchema) {
      for (const [characteristic, { label }] of Object.entries(CONFIG.EMOKLORE.characteristics)) {
        const field = characteristicSchema.getField(`${characteristic}.value`);
        if (!field) continue;
        field.label = label;
      }
    }

    const skillsSchema = (model as any).schema.getField("skills");
    if (skillsSchema) {
      for (const [skill, { label }] of Object.entries(CONFIG.EMOKLORE.skills)) {
        const field = skillsSchema.getField(`${skill}`);
        if (!field) continue;
        field.fields.label.initial = label;
      }
    }

    const baseSkillsSchema = (model as any).schema.getField("baseSkills");
    if (baseSkillsSchema) {
      for (const [skill, { label }] of Object.entries(CONFIG.EMOKLORE.baseSkills)) {
        const field = baseSkillsSchema.getField(`${skill}`);
        if (!field) continue;
        field.fields.label.initial = label;
      }
    }
  }
});

Hooks.once("ready", () => {
  if (game.settings.get(systemID as any, "developerMode" as any)) {
    (game.actors as any).get("IqCtJnUqjTsjXqss").sheet.render(true);
  }
});
