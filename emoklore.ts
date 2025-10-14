import { EMOKLORE } from "./module/config";
import { systemID } from "./module/constants";

import { EmokloreActor } from "./module/documents/actor";
import { EmokloreItem } from "./module/documents/item";

import { WeaponDataModel } from "./module/data/item-models";
import { CharacterDataModel } from "./module/data/character";
import { NpcDataModel } from "./module/data/npc";

import * as applications from "./module/sheets/character-sheet";

import { performPreLocalization } from "./module/helpers/localization";

import { EmokloreDie } from './module/dice/emoklore-die';
// import { EmokloreRollParser } from './module/dice/emoklore-parser';
import { EmokloreRoll } from "./module/dice/emoklore-roll";
import { registerSystemSettings } from "./module/settings";

// @ts-expect-error
Hooks.once("init", () => {
  console.log("Emo-klore TRPG | Initializing...");

  CONFIG.EMOKLORE = EMOKLORE;

  registerSystemSettings();

  // Configure custom Document implementations.
  (CONFIG as any).Actor.documentClass = EmokloreActor;
  CONFIG.Item.documentClass = EmokloreItem;

  // Configure System Data Models.
  CONFIG.Actor.dataModels = {
    character: CharacterDataModel,
    npc: NpcDataModel,
  };
  CONFIG.Item.dataModels = {
    weapon: WeaponDataModel,
  };

  // CONFIG.Dice.parser = EmokloreRollParser;
  CONFIG.Dice.rolls.push(EmokloreRoll);
  CONFIG.Dice.terms["d"] = EmokloreDie;

  // Configure trackable attributes.
  // TODO: Not Translated
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
  // DocumentSheetConfig.unregisterSheet(Actor, "core", foundry.appv1.sheets.ActorSheet);

  DocumentSheetConfig.registerSheet(Actor, "emoklore", applications.EmokloreCharacterSheet, {
    types: ["character"],
    makeDefault: true,
    label: "EMOKLORE.SheetClass.character",
  });
});

// @ts-expect-error
Hooks.once("i18nInit", () => {
  performPreLocalization(CONFIG.EMOKLORE);

  // These fields are not auto-localized due to having a different location in ja.json
  for (const model of Object.values(CONFIG.Actor.dataModels)) {
    /** @type {foundry.data.fields.SchemaField} */
    const characteristicSchema = model.schema.getField("characteristics");
    if (characteristicSchema) {
      for (const [characteristic, { label }] of Object.entries(CONFIG.EMOKLORE.characteristics)) {
        const field = characteristicSchema.getField(`${characteristic}.value`);
        if (!field) continue;
        field.label = label;
      }
    }

    const skillsSchema = model.schema.getField("skills");
    if (skillsSchema) {
      for (const [skill, { label }] of Object.entries(CONFIG.EMOKLORE.skills)) {
        const field = skillsSchema.getField(`${skill}`);
        if (!field) continue;
        field.fields.label.initial = label;
      }
    }

    const baseSkillsSchema = model.schema.getField("baseSkills");
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
  if (game.settings.get(systemID, "developerMode")) {
    game.actors.get("IqCtJnUqjTsjXqss").sheet.render(true);
  }
});
