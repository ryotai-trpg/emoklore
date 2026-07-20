// キャラクターシートの描画。全パートが描け、モードが切り替わり、翻訳が解決しているか。
import { TAG } from "../lib/config.mjs";
import { assertInPage } from "../lib/harness.mjs";

export const title = "キャラクターシート";

export async function run({ page, check }) {
  await check("全パートが描画される", () =>
    assertInPage(
      page,
      async (tag) => {
        const a = game.actors.getName(`${tag}_char`);
        await a.sheet.render(true);
        await window.__waitFor(
          () => a.sheet.rendered && a.sheet.element?.querySelector("[data-roll-type=base-skill]"),
          { label: "キャラクターシートの描画" },
        );

        // ApplicationV2 はタブに関係なく全パートを描く（非活性は hidden になるだけ）。
        // つまりパートが1つでも欠けていれば、そのテンプレートが描けていない
        const expected = Object.keys(a.sheet.constructor.PARTS);
        const el = a.sheet.element;
        const missing = expected.filter(
          (part) => !el.querySelector(`[data-application-part="${part}"]`),
        );
        return {
          ok: missing.length === 0,
          detail:
            missing.length === 0
              ? `${expected.length}パート（${expected.join(" ")}）`
              : `描かれていないパート: ${missing.join(", ")}`,
        };
      },
      TAG,
    ),
  );

  await check("編集モードに切り替わると全技能が出る", () =>
    assertInPage(
      page,
      async (tag) => {
        const sheet = game.actors.getName(`${tag}_char`).sheet;
        // 技能行の根っこは両モード共通で .em-skill-row。判定ボタン（data-roll-type）は
        // 閲覧モードにしか無いので、モードを跨いで数えるにはこちらを使う
        const count = () => sheet.element.querySelectorAll(".em-skill-row").length;

        // 閲覧モードは修得済みの技能だけを出す。取得していない技能まで並べると
        // プレイ中に読めなくなるため
        const play = count();
        await window.__setMode(sheet, "edit");
        const edit = count();
        await window.__setMode(sheet, "play");

        const all = Object.keys(CONFIG.EMOKLORE.skills).length;
        const ok = sheet.isPlayMode && edit === all && play < all;
        return {
          ok,
          detail: ok
            ? `閲覧${play} → 編集${edit}（全${all}）`
            : `閲覧${play} 編集${edit} 全${all} isPlayMode=${sheet.isPlayMode}`,
        };
      },
      TAG,
    ),
  );

  await check("未解決の翻訳キーが表示されていない", () =>
    assertInPage(
      page,
      async (tag) => {
        const sheet = game.actors.getName(`${tag}_char`).sheet;
        const leaked = new Map();

        // 閲覧と編集で描くテンプレートが違うので、両方を見ないと片方を見逃す。
        // 実際、分野の placeholder は編集モードにしか出てこない
        for (const [label, mode] of [
          ["閲覧", "play"],
          ["編集", "edit"],
        ]) {
          await window.__setMode(sheet, mode);
          for (const key of window.__findUnresolvedKeys(sheet.element)) {
            if (!leaked.has(key)) leaked.set(key, label);
          }
        }
        await window.__setMode(sheet, "play");

        const found = [...leaked].map(([key, mode]) => `${key}（${mode}）`);
        return {
          ok: found.length === 0,
          detail:
            found.length === 0 ? "閲覧・編集とも なし" : `生キー: ${found.slice(0, 5).join(", ")}`,
        };
      },
      TAG,
    ),
  );
}
