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
    const bonus = 0;
    options.skillName = "♾️共鳴";
    options.level= this.system.resources.resonance.value;
    options.baseTarget = intensity
    options.successModifier = 0;
    options.targetModifier = 0;
    options.bonus = bonus;
    console.log(options)

    const roll =
      bonus == 0
        ? await new EmokloreRoll(`${options.level}d10`, {}, options).evaluate()
        : await new EmokloreRoll(`(${options.level} + @bonus)d10`, { bonus: bonus }, options).evaluate();

    const messageData = {
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `
      `,
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

    options.successModifier = successModifier;
    options.skillName = `${prefix}${label}`;
    options.bonus = bonus;
    options.level = level;
    options.baseTarget = baseTarget;
    options.targetModifier = targetModifier;

    const roll =
      bonus == 0
        ? await new EmokloreRoll(`${level}d10`, {}, options).evaluate()
        : await new EmokloreRoll(`(${level} + @bonus)d10`, { bonus: bonus }, options).evaluate();

    const messageData = {
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `
      `,
      rolls: [roll],
      sound: CONFIG.sounds.dice,
      flags: { core: { canPopout: true } },
    };

    return ChatMessage.create(messageData);
  }
}
