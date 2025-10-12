import { EmokloreRoll } from "../dice/emoklore-roll.mjs";
import { formatDMPart } from "../helpers/helper.mjs";

export class EmokloreActor extends Actor {
  prepareDerivedData() {
    super.prepareDerivedData();
  }

  async adjustResource(resource, point) {
    const newvalue = this.system.resources[resource].value + point;
    return await this.update({ [`system.resources.${resource}.value`]: newvalue });
  }

  async rollResonance(intensity = 1, {...options} = {}) {

    const level= this.system.resources.resonance.value;

    options.target = intensity
    options.successMod = 0;
    options.dmFormula = `${level}DM≦${intensity}`;

    const roll = await new EmokloreRoll(`${level}d10`, {}, options).evaluate()

    const messageData = {
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format("EMOKLORE.skillRoll", {skillName: "♾️共鳴"}),
      rolls: [roll],
      sound: CONFIG.sounds.dice,
      flags: { core: { canPopout: true } },
    };

    return ChatMessage.create(messageData);
  }

  async rollSkill(skill, { base = false, ...options } = {}) {
    const skillSource = base ? this.system.baseSkills : this.system.skills;

    const {
      label,
      level,
      target: baseTarget,
      characteristic,
      group,
      isExtra,
    } = skillSource[skill];

    const {
      bonus: skillBonus,
      success: skillSuccessMod,
      target: skillTargetMod,
    } = skillSource[skill].mod;

    const {
      bonus: characteristicBonus,
      success: characteristicSuccessMod,
      target: characteristicTargetMod,
    } = this.system.characteristics[characteristic].mod;


    const {
      bonus: skillGroupBonus,
      success: skillGroupSuccessMod,
      target: skillGroupTargetMod,
    } = this.system.skillGroups[group].mod;

    const prefix = base ? "＊" : isExtra ? "★" : "";

    const targetMod =
      skillTargetMod + characteristicTargetMod + skillGroupTargetMod;
    const successMod =
      skillSuccessMod + characteristicSuccessMod + skillGroupSuccessMod;
    const bonus = skillBonus + characteristicBonus + skillGroupBonus;
    const skillName = `${prefix}${label}`;

    const leftPart = formatDMPart(level, bonus);
    const rightPart = formatDMPart(baseTarget, targetMod);

    options.dmFormula = `${leftPart}DM≦${rightPart}`;
    options.successMod = successMod;
    options.target = baseTarget+targetMod;

    const roll = await new EmokloreRoll(`${level+bonus}d10`, {}, options).evaluate()

    const messageData = {
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format("EMOKLORE.skillRoll", {skillName: skillName}),
      rolls: [roll],
      sound: CONFIG.sounds.dice,
      flags: { core: { canPopout: true } },
    };

    return ChatMessage.create(messageData);
  }
}
