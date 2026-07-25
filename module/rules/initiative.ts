import type { CharacteristicKey } from "../config/characteristics";
import type { SkillKey } from "../config/skills";

/**
 * イニシアチブの式。能力値に、状況に合う技能レベルを足す（技能が無ければ能力値だけ）。
 *
 * 戻り値はロールデータ（`EmokloreActor#getRollData`）に対して評価される式文字列。能力値・技能は
 * ロールデータに載っているので、`@characteristics.X.value` / `@skills.Y.level` がそのまま解決する。
 *
 * 既定の【身体】+〈スピード〉だけは派生値 `@initiative` を返す。`system.initiative` は
 * `persisted: false` のスキーマフィールドで ActiveEffect（final フェーズ）の着地点でもあるため、
 * 派生値を通すことで既定の基準では初速への効果が抜け落ちない。他の基準は入力（能力値・技能）
 * 側の効果だけが乗る。
 */
export function buildInitiativeFormula({
  characteristic,
  skill,
}: {
  characteristic: CharacteristicKey;
  skill: SkillKey | null;
}): string {
  if (characteristic === "physical" && skill === "speed") return "@initiative";

  const base = `@characteristics.${characteristic}.value`;
  return skill ? `${base} + @skills.${skill}.level` : base;
}
