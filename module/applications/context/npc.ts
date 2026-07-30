/**
 * 人間NPCシートがテンプレートに渡すデータの組み立て。
 *
 * 技能タブの行は共鳴者と同じビルダ（`context/skills.ts`）を通す。ここが持つのは
 * NPC固有の違いだけ — 基本技能の表示選択（`shownBaseSkills`）と、技能ポイント予算を
 * 持たないこと（`skillPointSum` / `skillPointMax` を積まない）。
 */

import type { NpcDataModel } from "../../data/npc";
import type { EmokloreActor } from "../../documents/actor";
import { typedEntries } from "../../utils/object";
import type { NpcSheetContext } from "../types";
import { buildSkillsContext } from "./skills";

/** このシートは type: "npc" にしか登録しないので、アクターは人間NPCに絞れる */
type NpcActor = EmokloreActor & { system: NpcDataModel };

/** 技能タブ。能力値のグリッドと、基本技能の表示選択もこのパートが持つ */
export const buildNpcSkillsContext = (
  actor: NpcActor,
  { isPlay }: { isPlay: boolean },
): Pick<
  NpcSheetContext,
  | "characteristics"
  | "skills"
  | "baseSkills"
  | "customSkills"
  | "customBaseSkills"
  | "baseSkillToggles"
> => {
  const system = actor.system;
  const { skills, baseSkills, customSkills, customBaseSkills } = buildSkillsContext(actor, {
    isPlay,
  });
  // Set<BaseSkillKey> のままだと string のキーで引けないので、表示用に広げる
  const shown = new Set<string>(system.shownBaseSkills);

  return {
    // 入力の min / max はスキーマから来させる。テンプレートに数値を書くと limits.ts と
    // 黙ってずれる。段階が min・max・step とも決まる数値は既定でスライダーになるので、
    // テンプレート側で type="number" を渡している（本体 NumberField#_toInput）
    characteristics: typedEntries(CONFIG.EMOKLORE.characteristics).map(([key, { label, fa }]) => ({
      key,
      label,
      icon: fa,
      value: system.characteristics[key].value,
      field: system.schema.getField(["characteristics", key, "value"]),
    })),
    skills,
    // 基本技能はレベルが常に1で「未修得」が無いので、Lv.0 のフィルタが使えない。
    // かわりに、どれを閲覧モードに出すかをアクターが持つ（`shownBaseSkills`）
    baseSkills: isPlay ? baseSkills.filter((row) => shown.has(row.key)) : baseSkills,
    customSkills,
    customBaseSkills,
    // 編集モードの選択リストは、選ぶ場所なので選択によらず全件出す
    baseSkillToggles: baseSkills.map((row) => ({ ...row, shown: shown.has(row.key) })),
  };
};
