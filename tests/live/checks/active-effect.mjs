// 効果。状態異常の登録と、効果タブから作られる効果の中身を見る。
//
// statusEffects は本体既定を丸ごと置き換えている。duration のスキーマは {value, units} で、
// rounds/turns の直指定は無い。
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

  await check("範囲外の効果は捨てられず端に丸められる", () =>
    assertInPage(
      page,
      async (tag) => {
        const a = game.actors.getName(`${tag}_char`);
        // 能力値は1〜6、技能レベルは0〜3。スキーマにあるフィールドへの効果は
        // DataField 経由で clean を通るので、はみ出しても捨てられずクランプされる。
        // docs/active-effect.md がこの挙動を前提に書いてある
        const physicalBefore = a.system.characteristics.physical.value;
        const [effect] = await a.createEmbeddedDocuments("ActiveEffect", [
          {
            name: `${tag}_clamp`,
            system: {
              changes: [
                {
                  key: "system.characteristics.physical.mod.bonus",
                  type: "add",
                  value: 99,
                  phase: "initial",
                },
                {
                  key: "system.characteristics.physical.value",
                  type: "add",
                  value: 99,
                  phase: "initial",
                },
              ],
            },
          },
        ]);
        const clamped = a.system.characteristics.physical.value;
        // mod には範囲を付けていないので、そちらは素通しで足される
        const unbounded = a.system.characteristics.physical.mod.bonus;
        await effect.delete();

        const ok = clamped === 6 && unbounded === 99;
        return {
          ok,
          detail: ok
            ? `【身体】${physicalBefore}+99 → 6（上限で丸め）、範囲の無い mod は 99 のまま`
            : `能力値=${clamped}（期待6） mod=${unbounded}（期待99）`,
        };
      },
      TAG,
    ),
  );

  await check("差し替えた効果シートが使われる", () =>
    assertInPage(
      page,
      async (tag) => {
        // 登録表ではなく、実際に効果が開くシートを見る。
        // getSheetClassesForSubType が返すのは id とラベルで、クラスではない
        const a = game.actors.getName(`${tag}_char`);
        const [effect] = await a.createEmbeddedDocuments("ActiveEffect", [
          { name: `${tag}_sheet`, system: { changes: [] } },
        ]);
        const name = effect.sheet?.constructor?.name;
        await effect.delete();

        const ok = name === "EmokloreActiveEffectConfig";
        return { ok, detail: ok ? name : `使われたシート=${name}` };
      },
      TAG,
    ),
  );

  await check("修正のキーが対象と修正先の選択に分解される", () =>
    assertInPage(
      page,
      async (tag) => {
        const a = game.actors.getName(`${tag}_char`);
        const [effect] = await a.createEmbeddedDocuments("ActiveEffect", [
          {
            name: `${tag}_sheet`,
            system: {
              changes: [
                {
                  key: "system.characteristics.mentality.mod.bonus",
                  type: "add",
                  value: 1,
                  phase: "initial",
                },
              ],
            },
          },
        ]);
        try {
          await effect.sheet.render(true);
          await window.__waitFor(() => effect.sheet.element?.querySelector("[data-change-row]"), {
            label: "変更行の描画",
          });
          const row = effect.sheet.element.querySelector("[data-change-row]");
          const target = row.querySelector("[data-change-key-part=target]");
          const aspect = row.querySelector("[data-change-key-part=aspect]");
          const raw = row.querySelector("[data-change-key-part=raw]");
          const phase = row.querySelector("[name$='.phase']");

          const ok =
            target?.value === "characteristics.mentality" &&
            aspect?.value === "bonus" &&
            raw?.hidden === true &&
            // 本体は phase を hidden でしか持たない。選べることがこの差し替えの主眼
            phase?.tagName === "SELECT";

          return {
            ok,
            detail: ok
              ? `対象=${target.value} 修正先=${aspect.value} 段階は${phase.tagName}で選べる`
              : `対象=${target?.value} 修正先=${aspect?.value} 生入力hidden=${raw?.hidden} 段階=${phase?.tagName}`,
          };
        } finally {
          await effect.sheet.close();
          await effect.delete();
        }
      },
      TAG,
    ),
  );

  await check("選択を変えると属性キーが組み立て直される", () =>
    assertInPage(
      page,
      async (tag) => {
        const a = game.actors.getName(`${tag}_char`);
        const [effect] = await a.createEmbeddedDocuments("ActiveEffect", [
          {
            name: `${tag}_sheet`,
            system: {
              changes: [{ key: "system.mod.bonus", type: "add", value: 1, phase: "initial" }],
            },
          },
        ]);
        try {
          await effect.sheet.render(true);
          await window.__waitFor(() => effect.sheet.element?.querySelector("[data-change-row]"), {
            label: "変更行の描画",
          });
          const row = effect.sheet.element.querySelector("[data-change-row]");
          const target = row.querySelector("[data-change-key-part=target]");
          const aspect = row.querySelector("[data-change-key-part=aspect]");
          const key = row.querySelector("[data-change-key]");

          const before = key.value;
          target.value = "skills.search";
          target.dispatchEvent(new Event("change", { bubbles: true }));
          aspect.value = "success";
          aspect.dispatchEvent(new Event("change", { bubbles: true }));
          const after = key.value;

          // 生入力へ倒したら、そちらの値がそのままキーになる
          target.value = "__raw";
          target.dispatchEvent(new Event("change", { bubbles: true }));
          const rawInput = row.querySelector("[data-change-key-part=raw]");
          rawInput.value = "system.initiative";
          rawInput.dispatchEvent(new Event("change", { bubbles: true }));
          const rawKey = key.value;

          const ok =
            before === "system.mod.bonus" &&
            after === "system.skills.search.mod.success" &&
            rawKey === "system.initiative" &&
            rawInput.hidden === false;

          return {
            ok,
            detail: ok
              ? `${before} → ${after} → ${rawKey}（生入力）`
              : `前=${before} 後=${after} 生=${rawKey} hidden=${rawInput.hidden}`,
          };
        } finally {
          await effect.sheet.close();
          await effect.delete();
        }
      },
      TAG,
    ),
  );

  await check("足したばかりの行は選択式で始まる", () =>
    assertInPage(
      page,
      async (tag) => {
        const a = game.actors.getName(`${tag}_char`);
        const [effect] = await a.createEmbeddedDocuments("ActiveEffect", [
          { name: `${tag}_sheet`, system: { changes: [] } },
        ]);
        try {
          await effect.sheet.render(true);
          await window.__waitFor(
            () => effect.sheet.element?.querySelector("[data-action=addChange]"),
            {
              label: "変更タブの描画",
            },
          );
          // 本体の #onAddChange は key が空の行を足す。空を「読み取れないキー」と
          // 同じ扱いにすると、行を足すたびに生入力が出てしまう
          effect.sheet.element.querySelector("[data-action=addChange]").click();
          await window.__waitFor(() => effect.sheet.element?.querySelector("[data-change-row]"), {
            label: "追加した変更行",
          });

          const row = effect.sheet.element.querySelector("[data-change-row]");
          const target = row.querySelector("[data-change-key-part=target]");
          const raw = row.querySelector("[data-change-key-part=raw]");
          const aspect = row.querySelector("[data-change-key-part=aspect]");
          const key = row.querySelector("[data-change-key]");

          const ok =
            target?.value === "" &&
            raw?.hidden === true &&
            aspect?.hidden === false &&
            key?.value === "";

          return {
            ok,
            detail: ok
              ? "対象は未選択、生入力は出ない、キーは空のまま"
              : `対象=${target?.value} 生入力hidden=${raw?.hidden} 修正先hidden=${aspect?.hidden} キー=${key?.value}`,
          };
        } finally {
          await effect.sheet.close();
          await effect.delete();
        }
      },
      TAG,
    ),
  );

  await check("選択式で扱えないキーは生入力に倒れる", () =>
    assertInPage(
      page,
      async (tag) => {
        const a = game.actors.getName(`${tag}_char`);
        const [effect] = await a.createEmbeddedDocuments("ActiveEffect", [
          {
            name: `${tag}_sheet`,
            system: {
              changes: [{ key: "system.initiative", type: "add", value: 2, phase: "final" }],
            },
          },
        ]);
        try {
          await effect.sheet.render(true);
          await window.__waitFor(() => effect.sheet.element?.querySelector("[data-change-row]"), {
            label: "変更行の描画",
          });
          const row = effect.sheet.element.querySelector("[data-change-row]");
          const target = row.querySelector("[data-change-key-part=target]");
          const raw = row.querySelector("[data-change-key-part=raw]");
          const aspect = row.querySelector("[data-change-key-part=aspect]");

          // ここを塞ぐと、載っている有効な効果が編集できなくなる
          const ok =
            target?.value === "__raw" &&
            raw?.value === "system.initiative" &&
            raw?.hidden === false &&
            aspect?.hidden === true;

          return {
            ok,
            detail: ok
              ? `対象=その他 生入力=${raw.value}`
              : `対象=${target?.value} 生入力=${raw?.value} hidden=${raw?.hidden}`,
          };
        } finally {
          await effect.sheet.close();
          await effect.delete();
        }
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
        // duration のスキーマは {value, units}。rounds を直に渡すとどこにも入らず、
        // 作った効果が「恒常」の側に並ぶ
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
