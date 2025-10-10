import "./emoklore.css"; // for dev

import { EMOKLORE } from "./module/config.mjs";
import { systemID } from "./module/constants.mjs";

import { EmokloreActor } from "./module/documents/actor.mjs";
import { EmokloreItem } from "./module/documents/item.mjs";

import { WeaponDataModel } from "./module/data/item-models.mjs";
import { CharacterDataModel } from "./module/data/character.mjs";
import { NpcDataModel } from "./module/data/npc.mjs";

import * as applications from "./module/sheets/character-sheet.mjs";

import { performPreLocalization } from "./module/helpers/localization.mjs";

// import { EmokloreDie } from './module/dice/emoklore-die.mjs';
// import { EmokloreRollParser } from './module/dice/emoklore-parser.mjs';
import { EmokloreRoll } from "./module/dice/emoklore-roll.mjs";
import { registerSystemSettings } from "./module/settings.mjs";

Hooks.once("init", () => {
  console.log("Emo-klore TRPG | Initializing...");

  CONFIG.EMOKLORE = EMOKLORE;

  registerSystemSettings();

  // Configure custom Document implementations.
  CONFIG.Actor.documentClass = EmokloreActor;
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
