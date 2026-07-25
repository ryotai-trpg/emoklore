import type { CharacteristicKey } from "../config/characteristics";
import { characteristics, isCharacteristicKey } from "../config/characteristics";
import { initiativePresets, isInitiativePresetKey } from "../config/initiative";
import type { SkillKey } from "../config/skills";
import { isSkillKey, skills } from "../config/skills";
import { systemPath } from "../constants";
import type { EmokloreCombat } from "../documents/combat";
import { typedEntries } from "../utils/object";

const { CombatTracker } = foundry.applications.sidebar.tabs;

const BAR_TEMPLATE = systemPath("templates/combat/initiative-bar.hbs");

/**
 * イニシアチブ基準の選択バーを後付けする CombatTracker。
 *
 * 本体トラッカーはApplicationV2。PARTを差し替えず、_onRender でバーを注入する
 * （issueが挙げる ryuutama の手法）。GMが基準（能力値＋技能）を選ぶと system に保存し、
 * 「全員再算出」で全Combatantへ反映する。プレイヤーには現在の基準を読み取り専用で見せる。
 */
export class EmokloreCombatTracker extends CombatTracker {
  override async _onRender(
    context: Parameters<InstanceType<typeof CombatTracker>["_onRender"]>[0],
    options: Parameters<InstanceType<typeof CombatTracker>["_onRender"]>[1],
  ): Promise<void> {
    await super._onRender(context, options);
    await this.#renderInitiativeBar();
  }

  /** 基準バーを描いて注入する。combat.system の変更を映すため毎回入れ直す */
  async #renderInitiativeBar(): Promise<void> {
    this.element.querySelector(".em-initiative-basis")?.remove();

    const combat = this.viewed as EmokloreCombat | null;
    if (!combat) return;

    const html = await foundry.applications.handlebars.renderTemplate(
      BAR_TEMPLATE,
      this.#barContext(combat),
    );
    const fragment = document.createElement("template");
    fragment.innerHTML = html;
    const bar = fragment.content.firstElementChild;
    if (!bar) return;

    // ヘッダの直後（トラッカーリストの前）に差す。無ければ先頭に置く
    const header = this.element.querySelector('[data-application-part="header"]');
    if (header) header.insertAdjacentElement("afterend", bar);
    else this.element.prepend(bar);

    if (isGamemaster()) this.#activateBarListeners(bar, combat);
  }

  #barContext(combat: EmokloreCombat) {
    const { characteristic, skill } = combat.system;
    const presets = typedEntries(initiativePresets).map(([key, preset]) => ({
      key,
      label: preset.label,
      selected: preset.characteristic === characteristic && (preset.skill ?? "") === skill,
    }));
    return {
      isGM: isGamemaster(),
      basisLabel: basisLabel(characteristic, skill),
      presets,
      customSelected: !presets.some((preset) => preset.selected),
      characteristics: typedEntries(characteristics).map(([key, config]) => ({
        key,
        label: config.label,
        selected: key === characteristic,
      })),
      skills: typedEntries(skills).map(([key, config]) => ({
        key,
        label: config.label,
        selected: key === skill,
      })),
      noSkill: skill === "",
    };
  }

  #activateBarListeners(bar: Element, combat: EmokloreCombat): void {
    bar.querySelector('[data-em="preset"]')?.addEventListener("change", (event) => {
      const value = (event.target as HTMLSelectElement).value;
      // 「カスタム」など基準を持たない選択は無視する
      if (!isInitiativePresetKey(value)) return;
      const preset = initiativePresets[value];
      void combat.update({
        system: { characteristic: preset.characteristic, skill: preset.skill ?? "" },
      });
    });

    bar.querySelector('[data-em="characteristic"]')?.addEventListener("change", (event) => {
      const value = (event.target as HTMLSelectElement).value;
      if (isCharacteristicKey(value)) void combat.update({ system: { characteristic: value } });
    });

    bar.querySelector('[data-em="skill"]')?.addEventListener("change", (event) => {
      const value = (event.target as HTMLSelectElement).value;
      // 空文字は「技能なし」。それ以外は技能キーのときだけ通す
      if (value === "" || isSkillKey(value)) void combat.update({ system: { skill: value } });
    });

    bar.querySelector('[data-em="recompute"]')?.addEventListener("click", () => {
      void combat.recomputeAll();
    });
  }
}

/** 現在のユーザーがGMか。本体の User 型は mixin 経由で isGM を落とすので交差型で補う */
function isGamemaster(): boolean {
  const user = game.user as (foundry.documents.User & { isGM: boolean }) | null;
  return user?.isGM ?? false;
}

/** 【身体】＋〈スピード〉のような基準の表示文字列 */
function basisLabel(characteristic: CharacteristicKey, skill: SkillKey | ""): string {
  const char = `【${characteristics[characteristic].label}】`;
  return skill ? `${char}＋〈${skills[skill].label}〉` : char;
}
