import type { CharacteristicKey } from "./characteristics";
import type { SkillKey } from "./skills";

/**
 * イニシアチブの基準（能力値1つ＋状況に合う技能）のプリセット。
 *
 * ルール上イニシアチブ値は状況ごとに「能力値＋技能レベル」で決める。よく使う組を
 * 名前付きで持ち、エンカウンターごとにトラッカーから選べるようにする。skill が null の
 * プリセット（【心肺停止】の【器用】）は能力値だけで算出する。
 */
export interface InitiativePresetConfig {
  label: string;
  characteristic: CharacteristicKey;
  skill: SkillKey | null;
}

const definitions = {
  combat: {
    label: "EMOKLORE.Config.initiativePresets.combat",
    characteristic: "physical",
    skill: "speed",
  },
  underwater: {
    label: "EMOKLORE.Config.initiativePresets.underwater",
    characteristic: "physical",
    skill: "dive",
  },
  search: {
    label: "EMOKLORE.Config.initiativePresets.search",
    characteristic: "sensitivity",
    skill: "keenObservation",
  },
  debate: {
    label: "EMOKLORE.Config.initiativePresets.debate",
    characteristic: "intelligence",
    skill: "debate",
  },
  // 【心肺停止】が出たときの新規ラウンド進行。イニシアチブは【器用】のみ
  cardiacArrest: {
    label: "EMOKLORE.Config.initiativePresets.cardiacArrest",
    characteristic: "dexterity",
    skill: null,
  },
} satisfies Record<string, InitiativePresetConfig>;

export type InitiativePresetKey = keyof typeof definitions;

// satisfies だけだと各値が個別の狭い型に推論されるため、値の型は InitiativePresetConfig に揃える。
// キーは literal のまま保たれるので InitiativePresetKey が使える
export const initiativePresets: Record<InitiativePresetKey, InitiativePresetConfig> = definitions;

/** プリセットキーかどうか。DOMのdatasetから来た文字列を絞るときに通す */
export const isInitiativePresetKey = (value: string): value is InitiativePresetKey =>
  value in definitions;
