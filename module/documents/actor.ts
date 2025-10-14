import { EmokloreRoll } from "../dice/emoklore-roll";
import { formatDMPart } from "../helpers/helper";

export class EmokloreActor extends Actor {
  prepareDerivedData() {
    super.prepareDerivedData();
  }

  async adjustResource(resource, point) {
    const newvalue = this.system.resources[resource].value + point;
    return await this.update({ [`system.resources.${resource}.value`]: newvalue });
  }

  async rollResonance(intensity, emotionMatch, { ...options } = {}) {
    // TODO: 雑・リファクタ

    if (intensity === undefined) {
      try {
        [intensity, emotionMatch] = await (foundry.applications.api.DialogV2.prompt as any)({
          window: { title: "〈♾️共鳴〉判定" },
          content: `
          <div>
          <label for="intensity">強度</label>
          <input name="intensity" id="intensity" type="number" placeholder="1" min="1" max="9" autofocus>
          </div>
          <div>
          <label><input type="radio" name="choice" value="none" checked> 一致なし</label>
          <label><input type="radio" name="choice" value="root"> ルーツ属性一致</label>
          <label><input type="radio" name="choice" value="completely"> 完全一致</label>
          </div>
          `,
          ok: {
            label: "ロール",
            callback: (event, button, dialog) => {
              const value = button.form.elements.intensity.valueAsNumber;
              return [isNaN(value) || value <= 0 ? 1 : value, button.form.elements.choice.value];
            },
          },
          rejectClose: true,
        });
      } catch {
        return;
      }
    }

    let level = this.system.resources.resonance.value;

    if (emotionMatch == "root") {
      level += 1;
    } else if (emotionMatch == "completely") {
      level *= 2;
    }

    options.target = intensity;
    options.successMod = 0;

    options.dmFormula = `${level}DM≦${intensity}`;

    const roll = await new EmokloreRoll(`${level}d10`, {}, options).evaluate();

    const messageData = {
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format("EMOKLORE.skillRoll", { skillName: "♾️共鳴" }),
      rolls: [roll],
      sound: CONFIG.sounds.dice,
      flags: { core: { canPopout: true } },
    };

    return ChatMessage.create(messageData);
  }

  async rollSkill(skill, { base = false, ...options } = {}) {
    const skillSource = base ? this.system.baseSkills : this.system.skills;

    const { label, level, target: baseTarget, characteristic, group, isExtra } = skillSource[skill];

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

    const targetMod = skillTargetMod + characteristicTargetMod + skillGroupTargetMod;
    const successMod = skillSuccessMod + characteristicSuccessMod + skillGroupSuccessMod;
    const bonus = skillBonus + characteristicBonus + skillGroupBonus;
    const skillName = `${prefix}${label}`;

    const leftPart = formatDMPart(level, bonus);
    const rightPart = formatDMPart(baseTarget, targetMod);

    options.dmFormula = `${leftPart}DM≦${rightPart}`;
    options.successMod = successMod;
    options.target = baseTarget + targetMod;

    const roll = await new EmokloreRoll(`${level + bonus}d10`, {}, options).evaluate();

    const messageData = {
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format("EMOKLORE.skillRoll", { skillName: skillName }),
      rolls: [roll],
      sound: CONFIG.sounds.dice,
      flags: { core: { canPopout: true } },
    };

    return ChatMessage.create(messageData);
  }
}
