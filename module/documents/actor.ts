import { EmokloreRoll } from "../dice/emoklore-roll";
import { formatDMPart } from "../helpers/helper";
import type { CharacterDataModel } from "../data/character";

type ResonanceMatch = "none" | "root" | "completely";
type ResourceKey = "hp" | "mp" | "resonance";

export class EmokloreActor<SubType extends Actor.SubType = Actor.SubType> extends Actor<SubType> {
  declare system: SubType extends "character"
    ? CharacterDataModel
    : SubType extends "npc"
      ? any // NPCの型定義が必要
      : any;

  async adjustResource(resource: ResourceKey, point: number): Promise<this | null> {
    const newvalue = (this.system.resources[resource]?.value ?? 0) + point;
    return await this.update({ [`system.resources.${resource}.value`]: newvalue });
  }

  async rollResonance(
    intensity?: number,
    emotionMatch?: ResonanceMatch,
    options: Record<string, unknown> = {},
  ): Promise<ChatMessage | undefined> {
    // TODO: Refactor

    if (intensity === undefined) {
      try {
        const result = await (
          foundry.applications.api.DialogV2.prompt as (args: {
            window: { title: string };
            content: string;
            ok: {
              label: string;
              callback: (event: Event, button: HTMLElement) => [number, ResonanceMatch];
            };
            rejectClose: boolean;
          }) => Promise<[number, ResonanceMatch]>
        )({
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
            callback: (event, button) => {
              const form = (button as any).form;
              const value = form.elements.intensity.valueAsNumber;
              return [isNaN(value) || value <= 0 ? 1 : value, form.elements.choice.value];
            },
          },
          rejectClose: true,
        });
        [intensity, emotionMatch] = result;
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

    (options as Record<string, unknown>)["target"] = intensity;
    (options as Record<string, unknown>)["successMod"] = 0;

    (options as Record<string, unknown>)["dmFormula"] = `${level}DM≦${intensity}`;

    const roll = await new EmokloreRoll(`${level}d10`, {}, options).evaluate();

    const messageData: any = {
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format("EMOKLORE.skillRoll", { skillName: "♾️共鳴" }),
      rolls: [roll],
      sound: (CONFIG as any).sounds.dice,
      flags: { core: { canPopout: true } },
    };

    return ChatMessage.create(messageData);
  }

  async rollSkill(
    skill: string,
    { base = false, ...options }: { base?: boolean } & Record<string, unknown> = {},
  ): Promise<ChatMessage | undefined> {
    const skillSource = base ? this.system.baseSkills : this.system.skills;

    const {
      label,
      level,
      target: baseTarget,
      characteristic,
      group,
      isExtra,
      specialization,
    } = skillSource[skill] as any;

    const {
      bonus: skillBonus,
      success: skillSuccessMod,
      target: skillTargetMod,
    } = (skillSource[skill] as any).mod;

    const {
      bonus: characteristicBonus,
      success: characteristicSuccessMod,
      target: characteristicTargetMod,
    } = (this.system.characteristics[characteristic] as any).mod;

    const {
      bonus: skillGroupBonus,
      success: skillGroupSuccessMod,
      target: skillGroupTargetMod,
    } = (this.system.skillGroups[group] as any).mod;

    const prefix = base ? "＊" : isExtra ? "★" : "";

    const targetMod = skillTargetMod + characteristicTargetMod + skillGroupTargetMod;
    const successMod = skillSuccessMod + characteristicSuccessMod + skillGroupSuccessMod;
    const bonus = skillBonus + characteristicBonus + skillGroupBonus;
    const skillName = `${prefix}${label}${specialization ? `${game.i18n.localize("colon")}${specialization}` : ""}`;
    // TODO: Refactor

    const leftPart = formatDMPart(level, bonus);
    const rightPart = formatDMPart(baseTarget, targetMod);

    (options as Record<string, unknown>)["dmFormula"] = `${leftPart}DM≦${rightPart}`;
    (options as Record<string, unknown>)["successMod"] = successMod;
    (options as Record<string, unknown>)["target"] = baseTarget + targetMod;

    const roll = await new EmokloreRoll(`${level + bonus}d10`, {}, options).evaluate();

    const messageData: any = {
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format("EMOKLORE.skillRoll", { skillName: skillName }),
      rolls: [roll],
      sound: (CONFIG as any).sounds.dice,
      flags: { core: { canPopout: true } },
    };

    return ChatMessage.create(messageData);
  }
}
