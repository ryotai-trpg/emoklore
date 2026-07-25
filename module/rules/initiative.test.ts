import { describe, expect, it } from "vitest";
import { buildInitiativeFormula } from "./initiative";

describe("buildInitiativeFormula", () => {
  it("既定（身体+スピード）は派生値 @initiative を使う", () => {
    // @initiative を通すことで system.initiative への効果も乗る（入力から組み立てると抜ける）
    expect(buildInitiativeFormula({ characteristic: "physical", skill: "speed" })).toBe(
      "@initiative",
    );
  });

  it("能力値と技能レベルを足す", () => {
    expect(
      buildInitiativeFormula({ characteristic: "sensitivity", skill: "keenObservation" }),
    ).toBe("@characteristics.sensitivity.value + @skills.keenObservation.level");
  });

  it("技能なし（【心肺停止】の【器用】）は能力値だけになる", () => {
    expect(buildInitiativeFormula({ characteristic: "dexterity", skill: null })).toBe(
      "@characteristics.dexterity.value",
    );
  });

  it("身体でも技能が違えば入力から組み立てる", () => {
    // 派生値の特別扱いは 身体+スピード だけ。身体+ダイブは通常の組み立てに乗る
    expect(buildInitiativeFormula({ characteristic: "physical", skill: "dive" })).toBe(
      "@characteristics.physical.value + @skills.dive.level",
    );
  });
});
