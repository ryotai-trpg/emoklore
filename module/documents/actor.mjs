import { EmokloreRoll } from "../dice/emoklore-roll.mjs";

export class EmokloreActor extends Actor {
  prepareDerivedData() {
    super.prepareDerivedData();
  }

  async rollSkill(skill, options = {}) {
    // const { level, target, label } = this.system.baseSkills[skill]
    const { level, target, label } = this.system.skills[skill];
    options.target = target;
    let roll = await new EmokloreRoll(level + "d10", {}, options).evaluate();
    // TODO: JSの引数の取り方がわからん

    const messageData = {
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor:
        "<h3>" +
        game.i18n.format("EMOKLORE.skillRoll", {
          skillName: label,
        }) +
        "</h3><br>判定値：" +
        target,
      rolls: [roll],
      sound: CONFIG.sounds.dice,
      flags: { core: { canPopout: true } },
    };
    // ChatMessage.applyRollMode(messageData, rollMode);
    return ChatMessage.create(messageData);
  }

  async rollBaseSkill(skill, options = {}) {
    // const { level, target, label } = this.system.baseSkills[skill]
    const { level, target, label } = this.system.baseSkills[skill];
    options.target = target;
    let roll = await new EmokloreRoll(level + "d10", {}, options).evaluate();
    // TODO: JSの引数の取り方がわからん

    const messageData = {
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor:
        "<h3>" +
        game.i18n.format("EMOKLORE.skillRoll", {
          skillName: "*" + label,
        }) +
        "</h3><br>判定値：" +
        target,
      rolls: [roll],
      sound: CONFIG.sounds.dice,
      flags: { core: { canPopout: true } },
    };
    // ChatMessage.applyRollMode(messageData, rollMode);
    return ChatMessage.create(messageData);
  }
}
