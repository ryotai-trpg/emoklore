// 判定。シートのクリックからロールが飛ぶまでを、4つの経路すべてで見る。
import { TAG } from "../lib/config.mjs";
import { assertInPage } from "../lib/harness.mjs";

export const title = "判定";

export async function run({ page, check }) {
  await check("技能判定がシートのクリックで飛ぶ", () =>
    assertInPage(
      page,
      async (tag) => {
        const a = game.actors.getName(`${tag}_char`);
        const el = a.sheet.element.querySelector("[data-roll-type=skill][data-skill=search]");
        if (!el) return { ok: false, detail: "〈検索〉の判定ボタンが無い" };
        const before = game.messages.size;
        el.click();
        await window.__waitFor(() => game.messages.size > before, {
          soft: true,
          label: "技能判定のメッセージ",
        });
        const m = game.messages.contents.at(-1);
        const ok = game.messages.size === before + 1 && /検索/.test(m?.flavor ?? "");
        return {
          ok,
          detail: ok
            ? `${m.flavor} ${m.rolls[0].formula}`
            : `増分${game.messages.size - before} flavor=${m?.flavor}`,
        };
      },
      TAG,
    ),
  );

  await check("基本技能の見出しに ＊ が付く", () =>
    assertInPage(
      page,
      async (tag) => {
        const a = game.actors.getName(`${tag}_char`);
        const el = a.sheet.element.querySelector("[data-roll-type=base-skill]");
        if (!el) return { ok: false, detail: "基本技能の判定ボタンが無い" };
        const before = game.messages.size;
        el.click();
        await window.__waitFor(() => game.messages.size > before, {
          soft: true,
          label: "基本技能のメッセージ",
        });
        const m = game.messages.contents.at(-1);
        // ＊ は SkillRollContext の isBase から出る。base の受け渡しが切れると消える
        const ok = game.messages.size === before + 1 && (m?.flavor ?? "").includes("＊");
        return { ok, detail: ok ? m.flavor : `flavor=${m?.flavor}（＊が無い）` };
      },
      TAG,
    ),
  );

  await check("技能レベルがダイス数に反映される", () =>
    assertInPage(
      page,
      async (tag) => {
        const a = game.actors.getName(`${tag}_char`);
        const results = [];
        for (const level of [1, 3]) {
          await a.update({ "system.skills.search.level": level });
          // update でシートが描き直されるので、要素は毎回引き直す。
          // 掴んだままだとDOMから外れた古い要素をクリックし続けることになる
          const el = await window.__waitFor(
            () =>
              a.system.skills.search.level === level &&
              a.sheet.element.querySelector("[data-roll-type=skill][data-skill=search]"),
            { label: "技能レベルの反映" },
          );
          const before = game.messages.size;
          el.click();
          await window.__waitFor(() => game.messages.size > before, {
            soft: true,
            label: "判定のメッセージ",
          });
          results.push(game.messages.contents.at(-1)?.rolls[0]?.terms[0]?.number);
        }
        // レベルが上がればダイスが増える。ここが動かないと判定の根幹が壊れている
        const ok = results[0] < results[1];
        return {
          ok,
          detail: ok
            ? `Lv1→${results[0]}個 Lv3→${results[1]}個`
            : `ダイス数が増えない: ${results.join(" / ")}`,
        };
      },
      TAG,
    ),
  );

  await check("技能キーの綴り間違いは何も起こさない", () =>
    assertInPage(
      page,
      async (tag) => {
        const a = game.actors.getName(`${tag}_char`);
        const el = a.sheet.element.querySelector("[data-roll-type=skill][data-skill=search]");
        const original = el.dataset.skill;
        el.dataset.skill = "serch";
        const before = game.messages.size;
        const errsBefore = window.__errs.length;
        el.click();
        // ここだけは条件で待てない。「何も起きない」ことを確かめているので、
        // 起きるとしたら十分な猶予を与えたうえで、起きなかったことを見る
        await new Promise((r) => setTimeout(r, 300));
        const delta = game.messages.size - before;
        const newErrs = window.__errs.slice(errsBefore);
        el.dataset.skill = original;
        // 境界で型述語を通すようになる前は、CONFIG を引いた先の分割代入が TypeError になっていた
        const ok = delta === 0 && newErrs.length === 0;
        return {
          ok,
          detail: ok ? "メッセージも例外も出ない" : `増分${delta} 例外${JSON.stringify(newErrs)}`,
        };
      },
      TAG,
    ),
  );

  await check("共鳴判定のダイアログが開く", () =>
    assertInPage(
      page,
      async (tag) => {
        const a = game.actors.getName(`${tag}_char`);
        const el = a.sheet.element.querySelector("[data-roll-type=resonance]");
        if (!el) return { ok: false, detail: "共鳴判定のボタンが無い" };
        el.click();
        const findDialog = () =>
          [...foundry.applications.instances.values()].find((x) =>
            x.constructor.name.includes("Dialog"),
          );
        const dlg = await window.__waitFor(findDialog, {
          soft: true,
          label: "共鳴判定のダイアログ",
        });
        if (dlg) {
          await dlg.close();
          await window.__waitFor(() => !findDialog(), { soft: true, label: "ダイアログが閉じる" });
        }

        const before = game.messages.size;
        await a.rollResonance(3, "none");
        const m = game.messages.contents.at(-1);
        const ok = Boolean(dlg) && game.messages.size === before + 1;
        return {
          ok,
          detail: ok
            ? `ダイアログ→${m.rolls[0].formula}`
            : `dialog=${Boolean(dlg)} 増分${game.messages.size - before}`,
        };
      },
      TAG,
    ),
  );
}
