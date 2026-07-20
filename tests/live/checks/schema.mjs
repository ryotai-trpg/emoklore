// スキーマの中身。CONFIG.EMOKLORE と保存データが対応しているかを見る。
import { TAG } from "../lib/config.mjs";
import { assertInPage } from "../lib/harness.mjs";

export const title = "スキーマ";

export async function run({ page, check }) {
  await check("スキーマのキーが CONFIG と一致する", () =>
    assertInPage(
      page,
      (tag) => {
        const s = game.actors.getName(`${tag}_char`).system;
        const diffs = [];
        const compare = (label, config, saved) => {
          const a = Object.keys(config).sort();
          const b = Object.keys(saved).sort();
          if (a.join() !== b.join()) {
            const missing = a.filter((k) => !b.includes(k));
            const extra = b.filter((k) => !a.includes(k));
            diffs.push(`${label}: 不足[${missing.join(",")}] 余分[${extra.join(",")}]`);
          }
        };
        compare("skills", CONFIG.EMOKLORE.skills, s.skills);
        compare("baseSkills", CONFIG.EMOKLORE.baseSkills, s.baseSkills);
        compare("characteristics", CONFIG.EMOKLORE.characteristics, s.characteristics);
        compare("skillGroups", CONFIG.EMOKLORE.skillGroups, s.skillGroups);
        return {
          ok: diffs.length === 0,
          detail:
            diffs.length === 0
              ? `技能${Object.keys(s.skills).length} 基本技能${Object.keys(s.baseSkills).length} 能力値${Object.keys(s.characteristics).length} 群${Object.keys(s.skillGroups).length}`
              : diffs.join(" / "),
        };
      },
      TAG,
    ),
  );

  await check("技能の各項目が揃っている", () =>
    assertInPage(
      page,
      (tag) => {
        const s = game.actors.getName(`${tag}_char`).system;
        const chcKeys = Object.keys(CONFIG.EMOKLORE.characteristics);
        const groupKeys = Object.keys(CONFIG.EMOKLORE.skillGroups);
        const bad = [];

        for (const [key, config] of Object.entries(CONFIG.EMOKLORE.skills)) {
          const entry = s.skills[key];
          for (const field of ["level", "characteristic", "mod", "target"]) {
            if (entry?.[field] === undefined) bad.push(`skills.${key}.${field}`);
          }
          for (const m of ["bonus", "success", "target"]) {
            if (entry?.mod?.[m] === undefined) bad.push(`skills.${key}.mod.${m}`);
          }
          // 保存された能力値キーと、CONFIG側が指す技能グループの両方が実在するか。
          // 表と表のあいだの参照は型で締めてあるが、保存データは型を裏切りうる
          if (!chcKeys.includes(entry?.characteristic)) {
            bad.push(`skills.${key}.characteristic=${entry?.characteristic}`);
          }
          if (!groupKeys.includes(config.group)) bad.push(`skills.${key}.group=${config.group}`);
          if (config.hasSpecialization && entry?.specialization === undefined) {
            bad.push(`skills.${key}.specialization`);
          }
        }

        for (const [key, config] of Object.entries(CONFIG.EMOKLORE.baseSkills)) {
          const entry = s.baseSkills[key];
          for (const field of ["level", "characteristic", "mod", "target"]) {
            if (entry?.[field] === undefined) bad.push(`baseSkills.${key}.${field}`);
          }
          if (!groupKeys.includes(config.group)) {
            bad.push(`baseSkills.${key}.group=${config.group}`);
          }
        }

        return {
          ok: bad.length === 0,
          detail: bad.length === 0 ? "欠け・参照切れなし" : bad.slice(0, 6).join(", "),
        };
      },
      TAG,
    ),
  );

  await check("派生値が入力に追随する", () =>
    assertInPage(
      page,
      async (tag) => {
        const a = game.actors.getName(`${tag}_char`);
        await a.update({ "system.characteristics.physical.value": 2 });
        const low = { hp: a.system.resources.hp.max, init: a.system.initiative };
        await a.update({ "system.characteristics.physical.value": 5 });
        const high = { hp: a.system.resources.hp.max, init: a.system.initiative };

        await a.update({ "system.skills.search.level": 1 });
        const t1 = a.system.skills.search.target;
        await a.update({ "system.skills.search.level": 3 });
        const t3 = a.system.skills.search.target;

        const ok = high.hp > low.hp && high.init > low.init && t3 > t1;
        return {
          ok,
          // 計算式そのものは rules/ の単体テストが持つ。ここは配線が生きているかだけ見る
          detail: ok
            ? `HP最大 ${low.hp}→${high.hp} 行動値 ${low.init}→${high.init} 目標値 ${t1}→${t3}`
            : `派生値が動かない: HP ${low.hp}→${high.hp} 行動値 ${low.init}→${high.init} 目標値 ${t1}→${t3}`,
        };
      },
      TAG,
    ),
  );

  await check("HPが最大値を超えない", () =>
    assertInPage(
      page,
      async (tag) => {
        const a = game.actors.getName(`${tag}_char`);
        const max = a.system.resources.hp.max;
        await a.update({ "system.resources.hp.value": max + 50 });
        const clamped = a.system.resources.hp.value;
        await a.update({ "system.resources.hp.value": max });
        return {
          ok: clamped === max,
          detail: clamped === max ? `${max + 50} → ${clamped}` : `${max + 50} が ${clamped} のまま`,
        };
      },
      TAG,
    ),
  );
}
