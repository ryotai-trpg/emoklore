// ハウリング反応（Item）。共鳴判定がトリプル以上だったときに共鳴表から引く先で、
// 引いた結果は共鳴者の持ち物になる。
//
// ここで見るのは器だけ（引く導線と効果タブは別）。回復判定の技能を「経路:キー」で
// 持つ形が、保存・choices・表示の3方向で噛み合っているかを確かめる。
import { TAG } from "../lib/config.mjs";
import { assertInPage } from "../lib/harness.mjs";

export const title = "ハウリング反応";

/** 検証で使う反応1件。汎用共鳴表「因縁タイプ」の 0009 精神汚染に相当する形 */
const REACTION = {
  type: "howling",
  system: {
    category: "attunement",
    effect: "<p>判定値に【精神】を使用する技能での判定は成功数-1される。</p>",
    recovery: {
      note: "",
      skills: ["base:self", "skill:psychology"],
    },
    notes: "<p>フレーバー</p>",
  },
};

export async function run({ page, check }) {
  await check("ハウリング反応シートが描画される", () =>
    assertInPage(
      page,
      async (tag, reaction) => {
        const actor = game.actors.getName(`${tag}_char`);
        const [item] = await actor.createEmbeddedDocuments("Item", [
          { ...reaction, name: `${tag}_精神汚染` },
        ]);

        await item.sheet.render(true);
        await window.__waitFor(() => item.sheet.rendered && item.sheet.element, {
          label: "ハウリング反応シートの描画",
        });
        await window.__setMode(item.sheet, "play");

        const el = item.sheet.element;
        const expected = Object.keys(item.sheet.constructor.PARTS);
        const missing = expected.filter(
          (part) => !el.querySelector(`[data-application-part="${part}"]`),
        );
        const leaked = window.__findUnresolvedKeys(el);
        const text = el.textContent;

        await item.sheet.close();

        if (missing.length > 0) {
          return { ok: false, detail: `描かれていないパート: ${missing.join(", ")}` };
        }
        if (leaked.length > 0) {
          return { ok: false, detail: `未解決の翻訳キー: ${[...new Set(leaked)].join(", ")}` };
        }
        // 分類は表示だけに使う値なので、翻訳済みで出ていることまで見る
        if (!text.includes("同調")) {
          return { ok: false, detail: "分類の表示名が出ていない" };
        }
        return { ok: true, detail: `${expected.length}パート（${expected.join(" ")}）分類=同調` };
      },
      TAG,
      REACTION,
    ),
  );

  await check("回復判定の技能は経路つきで保存され、表示は印つきになる", () =>
    assertInPage(
      page,
      async (tag) => {
        const actor = game.actors.getName(`${tag}_char`);
        const item = actor.items.getName(`${tag}_精神汚染`);

        // 保存データは「経路:キー」のまま。キーだけでは通常技能と基本技能を区別できない
        const saved = item.toObject().system.recovery.skills;

        await item.sheet.render(true);
        await window.__waitFor(() => item.sheet.rendered && item.sheet.element, {
          label: "ハウリング反応シートの描画",
        });
        await window.__setMode(item.sheet, "play");
        const text = item.sheet.element.textContent;
        await item.sheet.close();

        // 基本技能には ＊ が付く。印は判定カードやシートの表記と同じ綴り
        const shown = text.includes("＊自我／心理");
        const ok = saved.length === 2 && saved.includes("base:self") && shown;

        return {
          ok,
          detail: ok
            ? `保存=${saved.join(",")} 表示=＊自我／心理`
            : `保存=${JSON.stringify(saved)} 印つき表示=${shown}`,
        };
      },
      TAG,
    ),
  );

  await check("編集モードでは choices がそのまま複数選択になる", () =>
    assertInPage(
      page,
      async (tag) => {
        const actor = game.actors.getName(`${tag}_char`);
        const item = actor.items.getName(`${tag}_精神汚染`);

        await item.sheet.render(true);
        await window.__waitFor(() => item.sheet.rendered && item.sheet.element, {
          label: "ハウリング反応シートの描画",
        });
        await window.__setMode(item.sheet, "edit");

        const field = item.sheet.element.querySelector('[name="system.recovery.skills"]');
        // 本体の createMultiSelectInput は value に選択中の値の配列を持つ
        const selected = field ? [...(field.value ?? [])] : [];
        const leaked = window.__findUnresolvedKeys(item.sheet.element);

        await item.sheet.close();

        const ok =
          !!field &&
          selected.length === 2 &&
          selected.includes("base:self") &&
          selected.includes("skill:psychology") &&
          leaked.length === 0;

        return {
          ok,
          detail: ok
            ? `選択中=${selected.join(",")}`
            : `field=${!!field} 選択中=${JSON.stringify(selected)} 生キー: ${[...new Set(leaked)].join(",")}`,
        };
      },
      TAG,
    ),
  );

  await check("表に無い技能は choices が弾く", () =>
    assertInPage(
      page,
      async (tag) => {
        const actor = game.actors.getName(`${tag}_char`);
        const item = actor.items.getName(`${tag}_精神汚染`);

        let threw = false;
        try {
          await item.update({ "system.recovery.skills": ["skill:__nope"] });
        } catch (_error) {
          threw = true;
        }

        // 拒否されるか、少なくとも表に無い値が残らないこと
        const remains = item.system.recovery.skills.has("skill:__nope");
        const ok = !remains;

        return {
          ok,
          detail: ok
            ? threw
              ? "作成時に例外で拒否された"
              : "値が残らなかった"
            : "表に無いキーが保存された",
        };
      },
      TAG,
    ),
  );
}
