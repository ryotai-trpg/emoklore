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
        // 閲覧モードにしか無いので、モードを跨いで数えるにはこちらを使う。
        //
        // カスタム技能（.em-skill-row--custom）は組込の35件に含まれないので除く。
        // 除かないと、このチェックより先にカスタム技能を作った検証があるかどうかで
        // 結果が変わる（実際 custom-skill.mjs が2本作る）
        const count = () =>
          sheet.element.querySelectorAll(".em-skill-row:not(.em-skill-row--custom)").length;

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

  await check("最小幅まで縮めても組込の技能名が折り返さない", () =>
    assertInPage(
      page,
      async (tag) => {
        const actor = game.actors.getName(`${tag}_char`);
        const sheet = actor.sheet;
        if (!sheet.rendered) await sheet.render(true);
        await window.__setMode(sheet, "play");

        // 下限は「いちばん長い技能名が1行に収まるか」で決まっている。閲覧モードは
        // 修得済みしか出さないので、全技能をLv.1にして最長のものを画面に出す
        const before = Object.fromEntries(
          Object.keys(CONFIG.EMOKLORE.skills).map((key) => [
            `system.skills.${key}.level`,
            actor.system.skills[key].level,
          ]),
        );
        await actor.update(Object.fromEntries(Object.keys(before).map((path) => [path, 1])));
        const position = { ...sheet.position };

        try {
          await window.__waitFor(
            () =>
              sheet.element.querySelectorAll(".em-skill-row[data-skill]").length ===
              Object.keys(CONFIG.EMOKLORE.skills).length,
            { label: "全技能の描画" },
          );

          // 下限より狭い値を渡すと本体が min-width まで戻す（_updatePosition の clamp）。
          // つまりこれで「CSSが宣言している下限」そのものを測れる
          sheet.setPosition({ width: 100 });
          await new Promise((r) => requestAnimationFrame(() => r()));
          const floor = Math.round(sheet.element.getBoundingClientRect().width);

          // 分野つきは自由記述なのでどの幅でも折り返しうる。守れるのは表に載っている名前まで
          const wrapped = [...sheet.element.querySelectorAll(".em-skill-row[data-skill]")]
            .map((row) => row.querySelector(".em-skill-row__name"))
            .filter((name) => {
              const line = Number.parseFloat(getComputedStyle(name).lineHeight) || 20;
              return name.getBoundingClientRect().height > line * 1.4;
            })
            .map((name) => name.textContent.trim());

          return {
            ok: wrapped.length === 0,
            detail:
              wrapped.length === 0
                ? `下限${floor}px で全${Object.keys(before).length}件が1行`
                : `下限${floor}px で折り返し: ${wrapped.slice(0, 4).join(" ")}`,
          };
        } finally {
          await actor.update(before);
          sheet.setPosition(position);
        }
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
