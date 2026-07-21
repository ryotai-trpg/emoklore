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

  await check("全体修正が判定に効く", () =>
    assertInPage(
      page,
      async (tag) => {
        const a = game.actors.getName(`${tag}_char`);
        const el = a.sheet.element.querySelector("[data-roll-type=skill][data-skill=search]");
        if (!el) return { ok: false, detail: "〈検索〉の判定ボタンが無い" };

        // 目標値もダイス数も他の検証で動くので、絶対値ではなく前後の差で見る
        const rollOnce = async () => {
          const before = game.messages.size;
          el.click();
          await window.__waitFor(() => game.messages.size > before, {
            soft: true,
            label: "技能判定",
          });
          return game.messages.contents.at(-1)?.rolls?.[0]?.formula ?? "";
        };
        const parse = (formula) => {
          const m = /^(\d+)d10em<=(-?\d+)/.exec(formula);
          return m ? { dice: Number(m[1]), target: Number(m[2]) } : null;
        };

        const baseline = await rollOnce();
        const [effect] = await a.createEmbeddedDocuments("ActiveEffect", [
          {
            name: `${tag}_global`,
            system: {
              changes: [
                { key: "system.mod.target", type: "add", value: -2, phase: "initial" },
                { key: "system.mod.bonus", type: "add", value: 1, phase: "initial" },
              ],
            },
          },
        ]);
        const modified = await rollOnce();
        await effect.delete();

        const b = parse(baseline);
        const m = parse(modified);
        const ok = !!b && !!m && m.dice === b.dice + 1 && m.target === b.target - 2;
        return {
          ok,
          detail: ok ? `${baseline} → ${modified}` : `前=${baseline} 後=${modified}`,
        };
      },
      TAG,
    ),
  );

  await check("修正値は保存されないが効果は乗る", () =>
    assertInPage(
      page,
      async (tag) => {
        const a = game.actors.getName(`${tag}_char`);
        // persisted: false なので _source には出ない。スキーマには在るので効果は乗る
        const source = a._source.system;
        const stored = [
          source.mod !== undefined && "mod",
          source.characteristics?.physical?.mod !== undefined && "characteristics.physical.mod",
          source.skills?.search?.mod !== undefined && "skills.search.mod",
          source.initiative !== undefined && "initiative",
          source.resources?.hp?.max !== undefined && "resources.hp.max",
        ].filter(Boolean);

        const [effect] = await a.createEmbeddedDocuments("ActiveEffect", [
          {
            name: `${tag}_persist`,
            system: {
              changes: [{ key: "system.mod.target", type: "add", value: -2, phase: "initial" }],
            },
          },
        ]);
        const applied = a.system.mod.target;
        await effect.delete();
        const cleared = a.system.mod.target;

        const ok = stored.length === 0 && applied === -2 && cleared === 0;
        return {
          ok,
          detail: ok
            ? "保存データに mod / initiative / hp.max なし、効果は -2 → 0 で往復"
            : `保存された[${stored.join(",")}] 適用=${applied} 解除後=${cleared}`,
        };
      },
      TAG,
    ),
  );

  await check("派生値には final フェーズだけが効く", () =>
    assertInPage(
      page,
      async (tag) => {
        const a = game.actors.getName(`${tag}_char`);
        const base = a.system.initiative;

        const apply = async (phase) => {
          const [effect] = await a.createEmbeddedDocuments("ActiveEffect", [
            {
              name: `${tag}_${phase}`,
              system: { changes: [{ key: "system.initiative", type: "add", value: 2, phase }] },
            },
          ]);
          const got = a.system.initiative;
          await effect.delete();
          return got;
        };

        // initial は prepareDerivedData が行動値を入れ直すぶん消える。final はその後に乗る
        const afterInitial = await apply("initial");
        const afterFinal = await apply("final");

        const ok = afterInitial === base && afterFinal === base + 2;
        return {
          ok,
          detail: ok
            ? `行動値${base}: initial→${afterInitial}（消える） final→${afterFinal}`
            : `base=${base} initial=${afterInitial} final=${afterFinal}`,
        };
      },
      TAG,
    ),
  );

  await check("効果値に @ 参照と式が書ける", () =>
    assertInPage(
      page,
      async (tag) => {
        const a = game.actors.getName(`${tag}_char`);
        const level = a.system.skills.search.level;
        if (!level) return { ok: false, detail: "〈検索〉のレベルが0で、0との区別が付かない" };

        // 数値フィールドへの文字列は本体が Roll として評価する（NumberField._castChangeDelta）
        const [effect] = await a.createEmbeddedDocuments("ActiveEffect", [
          {
            name: `${tag}_ref`,
            system: {
              changes: [
                {
                  key: "system.mod.bonus",
                  type: "add",
                  value: "@skills.search.level * 2",
                  phase: "initial",
                },
              ],
            },
          },
        ]);
        const got = a.system.mod.bonus;
        await effect.delete();

        const ok = got === level * 2;
        return {
          ok,
          detail: ok
            ? `@skills.search.level * 2 → ${got}（レベル${level}）`
            : `期待${level * 2} 実際${got}`,
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
