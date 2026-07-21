// 効果。状態異常の登録と、効果タブから作られる効果の中身を見る。
//
// どちらもv14で形が変わったところ。statusEffects は本体既定を丸ごと置き換えており、
// duration は {value, units} になって rounds/turns の直指定がスキーマから消えた。
import { TAG } from "../lib/config.mjs";
import { assertInPage } from "../lib/harness.mjs";

export const title = "効果";

export async function run({ page, check }) {
  await check("状態異常がエモクロアのものに置き換わっている", () =>
    assertInPage(page, () => {
      const expected = [
        "unconscious",
        "cardiacArrest",
        "dead",
        "faint",
        "possessed",
        "deviation",
        "blind",
        "invisible",
      ];
      // Proxy は id でも添字でも引ける。両方を確かめる
      const byIndex = Array.from(foundry.utils.iterateValues(CONFIG.statusEffects)).map(
        (s) => s.id,
      );
      const missing = expected.filter((id) => !CONFIG.statusEffects[id]);
      const extra = byIndex.filter((id) => !expected.includes(id));
      // name は i18n キーのまま持ち、本体が読むときに解決する。未解決のまま出ないか
      const unresolved = expected.filter((id) => {
        const name = CONFIG.statusEffects[id]?.name;
        return !name || game.i18n.localize(name) === name;
      });

      const problems = [];
      if (missing.length > 0) problems.push(`不足[${missing.join(",")}]`);
      if (extra.length > 0) problems.push(`余分[${extra.join(",")}]`);
      if (unresolved.length > 0) problems.push(`未翻訳[${unresolved.join(",")}]`);
      // 並び順は order で決まる。指定が無いと表示名の localeCompare に倒れる
      if (byIndex.join() !== expected.join()) problems.push(`順序=${byIndex.join(",")}`);

      return {
        ok: problems.length === 0,
        detail:
          problems.length === 0
            ? `${expected.length}件（${expected.map((id) => game.i18n.localize(CONFIG.statusEffects[id].name)).join("・")}）`
            : problems.join(" / "),
      };
    }),
  );

  await check("specialStatusEffects の参照先が実在する", () =>
    assertInPage(page, () => {
      // DEFEATED は明示的に "dead" へ向けている。残りは本体既定のままなので、
      // 置き換えで参照先が消えたものは「使わない」ことがはっきりしていればよい
      const defeated = CONFIG.specialStatusEffects.DEFEATED;
      const ok = !!CONFIG.statusEffects[defeated];
      const dangling = Object.entries(CONFIG.specialStatusEffects)
        .filter(([, id]) => !CONFIG.statusEffects[id])
        .map(([key]) => key);
      return {
        ok,
        detail: ok
          ? `DEFEATED=${defeated}${dangling.length > 0 ? `（未使用: ${dangling.join(",")}）` : ""}`
          : `DEFEATED=${defeated} が statusEffects に無い`,
      };
    }),
  );

  await check("状態異常が付け外しできる", () =>
    assertInPage(
      page,
      async (tag) => {
        const a = game.actors.getName(`${tag}_char`);
        await a.toggleStatusEffect("unconscious");
        const on = a.statuses.has("unconscious");
        await a.toggleStatusEffect("unconscious");
        const off = !a.statuses.has("unconscious");
        return {
          ok: on && off,
          detail: on && off ? "付与→解除まで往復した" : `付与=${on} 解除=${off}`,
        };
      },
      TAG,
    ),
  );

  await check("一時的効果の作成が duration を持つ", () =>
    assertInPage(
      page,
      async (tag) => {
        const a = game.actors.getName(`${tag}_char`);
        const el = a.sheet.element.querySelector(
          "[data-effect-type=temporary] [data-action=createDoc][data-document-class=ActiveEffect]",
        );
        if (!el) return { ok: false, detail: "一時的効果の作成ボタンが無い" };

        const before = a.effects.size;
        el.click();
        await window.__waitFor(() => a.effects.size > before, {
          soft: true,
          label: "一時的効果の作成",
        });
        const effect = a.effects.contents.at(-1);
        // v14 のスキーマは {value, units}。data-duration.rounds を渡していたころは
        // どこにも入らず、作った効果が「恒常」の側に並んでいた
        const { value, units } = effect?.duration ?? {};
        const ok = value === 1 && units === "rounds" && effect?.isTemporary === true;
        const detail = ok
          ? `value=${value} units=${units} isTemporary=true`
          : `value=${value} units=${units} isTemporary=${effect?.isTemporary}`;

        await effect?.delete();
        return { ok, detail };
      },
      TAG,
    ),
  );
}
