// 技能タブの効果修正の可視化。実効値のセル・強調・ツールチップの配線を見る。
// 帰属の突き合わせそのものは utils/effect-breakdown.test.ts（vitest）が持ち、
// ここで見るのは効果を乗せたときに画面がそのとおり変わるか。
import { TAG } from "../lib/config.mjs";
import { assertInPage } from "../lib/harness.mjs";

export const title = "技能タブの修正表示";

export async function run({ page, check }) {
  await check("判定値修正が実効値でセルに乗り、強調と内訳が付く", () =>
    assertInPage(
      page,
      async (tag) => {
        const actor = game.actors.getName(`${tag}_char`);
        const sheet = actor.sheet;
        await sheet.render(true);
        await window.__waitFor(
          () => sheet.rendered && sheet.element?.querySelector(".em-skill-row"),
          {
            label: "シートの描画",
          },
        );
        await window.__setMode(sheet, "play");

        const base = actor.system.skills.search.target;
        const cell = () =>
          sheet.element.querySelector('.em-skill-row[data-skill="search"] .em-target');
        const before = cell()?.textContent.trim();

        const [effect] = await actor.createEmbeddedDocuments("ActiveEffect", [
          {
            name: `${tag}_集中`,
            system: {
              changes: [
                { key: "system.skills.search.mod.target", type: "add", value: 2, phase: "initial" },
              ],
            },
          },
        ]);
        try {
          await window.__waitFor(() => cell()?.textContent.trim() === String(base + 2), {
            soft: true,
            label: "実効値の反映",
          });
          const applied = cell();
          const shown = applied?.textContent.trim();
          const highlighted = applied?.classList.contains("em-target--modified") ?? false;
          const tooltip = applied?.dataset.tooltipHtml ?? "";
          const named = tooltip.includes("集中") && tooltip.includes("+2");

          // 編集モードは組み立ての画面なので基準値のまま
          await window.__setMode(sheet, "edit");
          const editCell = sheet.element.querySelector(
            '.em-skill-row--edit[data-skill="search"] .em-target',
          );
          const editBase = editCell?.textContent.trim() === String(base);
          await window.__setMode(sheet, "play");

          const ok =
            before === String(base) &&
            shown === String(base + 2) &&
            highlighted &&
            named &&
            editBase;
          return {
            ok,
            detail: `判定値 ${before} → ${shown}（強調=${highlighted} 内訳に効果名と金額=${named} 編集は基準値のまま=${editBase}）`,
          };
        } finally {
          await effect.delete();
        }
      },
      TAG,
    ),
  );

  await check("能力値へのダイスボーナスでLv表示が強調される", () =>
    assertInPage(
      page,
      async (tag) => {
        const actor = game.actors.getName(`${tag}_char`);
        const sheet = actor.sheet;
        if (!sheet.rendered) await sheet.render(true);
        await window.__setMode(sheet, "play");

        const chc = actor.system.skills.search.characteristic;
        const level = () =>
          sheet.element.querySelector(
            '.em-skill-row[data-skill="search"] .em-skill-row__level--modified',
          );

        const [effect] = await actor.createEmbeddedDocuments("ActiveEffect", [
          {
            name: `${tag}_号令`,
            system: {
              changes: [
                {
                  key: `system.characteristics.${chc}.mod.bonus`,
                  type: "add",
                  value: 1,
                  phase: "initial",
                },
              ],
            },
          },
        ]);
        try {
          await window.__waitFor(() => level(), { soft: true, label: "Lv強調の描画" });
          const emphasized = !!level();
          const tooltip =
            sheet.element.querySelector('.em-skill-row[data-skill="search"] .em-target')?.dataset
              .tooltipHtml ?? "";
          const named = tooltip.includes("ダイス") && tooltip.includes("号令");
          return {
            ok: emphasized && named,
            detail: `Lv強調=${emphasized} 内訳にダイスと効果名=${named}（能力値=${chc}）`,
          };
        } finally {
          await effect.delete();
        }
      },
      TAG,
    ),
  );

  await check("基本技能のチップにも実効値と強調が乗る", () =>
    assertInPage(
      page,
      async (tag) => {
        const actor = game.actors.getName(`${tag}_char`);
        const sheet = actor.sheet;
        if (!sheet.rendered) await sheet.render(true);
        await window.__setMode(sheet, "play");

        const base = actor.system.baseSkills.knowledge.target;
        const cell = () =>
          sheet.element.querySelector('.em-chip[data-skill="knowledge"] .em-target');

        const [effect] = await actor.createEmbeddedDocuments("ActiveEffect", [
          {
            name: `${tag}_下調べ`,
            system: {
              changes: [
                {
                  key: "system.baseSkills.knowledge.mod.target",
                  type: "add",
                  value: 1,
                  phase: "initial",
                },
              ],
            },
          },
        ]);
        try {
          await window.__waitFor(() => cell()?.textContent.trim() === String(base + 1), {
            soft: true,
            label: "チップへの反映",
          });
          const applied = cell();
          const ok =
            applied?.textContent.trim() === String(base + 1) &&
            applied.classList.contains("em-target--modified") &&
            (applied.dataset.tooltipHtml ?? "").includes("下調べ");
          return {
            ok,
            detail: `チップの判定値 ${base} → ${applied?.textContent.trim()}（強調=${applied?.classList.contains("em-target--modified")}）`,
          };
        } finally {
          await effect.delete();
        }
      },
      TAG,
    ),
  );

  await check("効果を無効にすると基準値と素の表示に戻る", () =>
    assertInPage(
      page,
      async (tag) => {
        const actor = game.actors.getName(`${tag}_char`);
        const sheet = actor.sheet;
        if (!sheet.rendered) await sheet.render(true);
        await window.__setMode(sheet, "play");

        const base = actor.system.skills.search.target;
        const cell = () =>
          sheet.element.querySelector('.em-skill-row[data-skill="search"] .em-target');

        const [effect] = await actor.createEmbeddedDocuments("ActiveEffect", [
          {
            name: `${tag}_一時強化`,
            system: {
              changes: [
                { key: "system.skills.search.mod.target", type: "add", value: 2, phase: "initial" },
              ],
            },
          },
        ]);
        try {
          await window.__waitFor(() => cell()?.classList.contains("em-target--modified") ?? false, {
            soft: true,
            label: "強調の描画",
          });
          const armed = cell()?.classList.contains("em-target--modified") ?? false;

          await effect.update({ disabled: true });
          await window.__waitFor(
            () => cell() && !cell().classList.contains("em-target--modified"),
            { soft: true, label: "強調の解除" },
          );
          const plain = cell();
          const ok =
            armed &&
            plain?.textContent.trim() === String(base) &&
            !plain?.classList.contains("em-target--modified") &&
            plain?.dataset.tooltipHtml === undefined;
          return {
            ok,
            detail: `強調 付与=${armed} → 無効化で解除=${!plain?.classList.contains("em-target--modified")}、値=${plain?.textContent.trim()}（基準${base}）`,
          };
        } finally {
          await effect.delete();
        }
      },
      TAG,
    ),
  );

  await check("NPCの技能タブでも同じ表示が乗る", () =>
    assertInPage(
      page,
      async (tag) => {
        const actor = game.actors.getName(`${tag}_npc`);
        const sheet = actor.sheet;
        if (!sheet.rendered) await sheet.render(true);
        await window.__setMode(sheet, "play");
        sheet.changeTab("skills", "primary");

        const base = actor.system.skills.search.target;
        const cell = () =>
          sheet.element.querySelector('.em-skill-row[data-skill="search"] .em-target');

        const [effect] = await actor.createEmbeddedDocuments("ActiveEffect", [
          {
            name: `${tag}_npc強化`,
            system: {
              changes: [
                { key: "system.skills.search.mod.target", type: "add", value: 2, phase: "initial" },
              ],
            },
          },
        ]);
        try {
          await window.__waitFor(() => cell()?.textContent.trim() === String(base + 2), {
            soft: true,
            label: "実効値の反映",
          });
          const applied = cell();
          const ok =
            applied?.textContent.trim() === String(base + 2) &&
            applied.classList.contains("em-target--modified");
          return {
            ok,
            detail: `判定値 ${base} → ${applied?.textContent.trim()}（強調=${applied?.classList.contains("em-target--modified")}）`,
          };
        } finally {
          await effect.delete();
        }
      },
      TAG,
    ),
  );

  await check("@参照の効果値も金額つきで内訳に出る", () =>
    assertInPage(
      page,
      async (tag) => {
        const actor = game.actors.getName(`${tag}_char`);
        const sheet = actor.sheet;
        if (!sheet.rendered) await sheet.render(true);
        await window.__setMode(sheet, "play");

        const base = actor.system.skills.search.target;
        const level = actor.system.skills.search.level;
        const cell = () =>
          sheet.element.querySelector('.em-skill-row[data-skill="search"] .em-target');

        const [effect] = await actor.createEmbeddedDocuments("ActiveEffect", [
          {
            name: `${tag}_練達`,
            system: {
              changes: [
                {
                  key: "system.skills.search.mod.target",
                  type: "add",
                  value: "@skills.search.level",
                  phase: "initial",
                },
              ],
            },
          },
        ]);
        try {
          await window.__waitFor(() => cell()?.textContent.trim() === String(base + level), {
            soft: true,
            label: "式の評価と反映",
          });
          const applied = cell();
          // 金額はセルの差分と同じ評価を通る。ずれていたら効果名だけになるので、
          // 「+レベル」が出ていること自体が突き合わせの成立を意味する
          const tooltip = applied?.dataset.tooltipHtml ?? "";
          const ok =
            applied?.textContent.trim() === String(base + level) &&
            tooltip.includes(`+${level}`) &&
            tooltip.includes("練達");
          return {
            ok,
            detail: `判定値 ${base} → ${applied?.textContent.trim()}（内訳に +${level} と効果名=${ok}）`,
          };
        } finally {
          await effect.delete();
        }
      },
      TAG,
    ),
  );
}
