import { EmokloreRoll } from "../dice/emoklore-roll.mjs";

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
    options.successModifier = 0;
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
      bonus: skillBonus,
      successModifier: skillSuccessModifier,
      targetModifier: skillTargetModifier,
      characteristic,
      group,
      isExtra,
    } = skillSource[skill];

    const {
      bonus: characteristicBonus,
      successModifier: characteristicSuccessModifier,
      targetModifier: characteristicTargetModifier,
    } = this.system.characteristics[characteristic];


    const {
      bonus: skillGroupBonus,
      successModifier: skillGroupSuccessModifier,
      targetModifier: skillGroupTargetModifier,
    } = this.system.skillGroups[group];

    const prefix = base ? "＊" : isExtra ? "★" : "";

    const targetModifier =
      skillTargetModifier + characteristicTargetModifier + skillGroupTargetModifier;
    const successModifier =
      skillSuccessModifier + characteristicSuccessModifier + skillGroupSuccessModifier;
    const bonus = skillBonus + characteristicBonus + skillGroupBonus;
    const skillName = `${prefix}${label}`;


    const bonusString = bonus > 0 ? `+${bonus}` : bonus;
    const leftPart = bonusString == 0
      ? level
      : `(${level}${bonusString})`;

    const targetModifierString = targetModifier > 0 
      ? `+${targetModifier}` 
      : targetModifier;

    const rightPart = targetModifierString == 0
      ? baseTarget
      : `(${baseTarget}${targetModifierString})`;

    options.dmFormula = `${leftPart}DM≦${rightPart}`;
    options.successModifier = successModifier;
    options.target = baseTarget+targetModifier;

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
