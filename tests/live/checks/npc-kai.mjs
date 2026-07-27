// 人間NPC（npc）と怪異（kai）の作成・シート描画・判定・攻撃・初速・装甲。
// 静的チェックでは通らない、種別ごとのランタイムの形を見る。
import { TAG } from "../lib/config.mjs";
import { assertInPage, DICE, pinDice } from "../lib/harness.mjs";

export const title = "NPC・怪異";

export async function run({ page, check }) {
  await check("npc・kai が作成でき、種別ごとの形を持つ", () =>
    assertInPage(
      page,
      (tag) => {
        const npc = game.actors.getName(`${tag}_npc`);
        const kai = game.actors.getName(`${tag}_kai`);
        // 人間NPCは共鳴者と同じ能力値・技能・HP/MPを持ち、邪気は持たない
        const npcOk =
          npc?.type === "npc" &&
          !!npc.system.resources.hp &&
          !!npc.system.skills?.search &&
          !("wickedness" in npc.system);
        // 怪異は攻撃リスト・装甲・固定初速・共鳴感情（Set）を持つ
        const kaiOk =
          kai?.type === "kai" &&
          kai.system.attacks.length === 3 &&
          kai.system.resources.armor === 5 &&
          kai.system.initiative === 6 &&
          kai.system.emotions.has("selfAssertion");
        return {
          ok: !!(npcOk && kaiOk),
          detail: `npc=${npc?.type}(技能あり,邪気なし) kai=${kai?.type} 攻撃${kai?.system.attacks.length} 装甲${kai?.system.resources.armor} 初速${kai?.system.initiative}`,
        };
      },
      TAG,
    ),
  );

  await check("npcシートが描画され、未解決キーが無い", () =>
    assertInPage(
      page,
      async (tag) => {
        const sheet = game.actors.getName(`${tag}_npc`).sheet;
        await sheet.render(true);
        await window.__waitFor(
          () => sheet.rendered && sheet.element?.querySelector("[data-roll-type=skill]"),
          { label: "npcシートの描画" },
        );

        const leaked = new Set();
        for (const mode of ["play", "edit"]) {
          await window.__setMode(sheet, mode);
          for (const key of window.__findUnresolvedKeys(sheet.element)) leaked.add(key);
        }
        await window.__setMode(sheet, "play");

        return {
          ok: leaked.size === 0,
          detail:
            leaked.size === 0
              ? "閲覧・編集とも なし"
              : `生キー: ${[...leaked].slice(0, 5).join(", ")}`,
        };
      },
      TAG,
    ),
  );

  await check("npcが共鳴者と同じ計算で技能判定を組み立てる", () =>
    assertInPage(
      page,
      async (tag) => {
        const npc = game.actors.getName(`${tag}_npc`);
        // 能力値＋技能から派生した目標値がそのまま判定式に乗る（getSkillRollContext を共有）
        const { roll } = await npc.buildSkillRoll({ kind: "skill", key: "search" });
        const target = npc.system.skills.search.target;
        const expected = `2DM≦${target}`;
        return {
          ok: roll.dmFormula === expected && Number.isInteger(target),
          detail: `${roll.dmFormula}（目標値=派生${target}）`,
        };
      },
      TAG,
    ),
  );

  await check("kaiシートが描画され、未解決キーが無い", () =>
    assertInPage(
      page,
      async (tag) => {
        const sheet = game.actors.getName(`${tag}_kai`).sheet;
        await sheet.render(true);
        await window.__waitFor(
          () => sheet.rendered && sheet.element?.querySelector(".em-kai__stats"),
          { label: "kaiシートの描画" },
        );

        const leaked = new Set();
        for (const mode of ["play", "edit"]) {
          await window.__setMode(sheet, mode);
          for (const key of window.__findUnresolvedKeys(sheet.element)) leaked.add(key);
        }

        // 攻撃欄のラベルはスキーマ（FIELDS.attacks.element.*）から引く。
        // 道を間違えると生キーではなく空文字になり、未解決キーの検査では見つからない
        await window.__setMode(sheet, "edit");
        const labels = [...sheet.element.querySelectorAll(".em-kai__attack-fields label")].map(
          (label) => label.firstChild?.textContent?.trim() ?? "",
        );
        const namePlaceholder =
          sheet.element.querySelector(".em-kai__attack-name-input")?.placeholder ?? "";
        const blank = labels.filter((label) => label === "").length;
        await window.__setMode(sheet, "play");

        // 攻撃1件につきラベルが6つ。件数は検証データ側の都合なので割り切れることだけ見る
        const ok =
          leaked.size === 0 &&
          labels.length > 0 &&
          labels.length % 6 === 0 &&
          blank === 0 &&
          namePlaceholder !== "";
        return {
          ok,
          detail: ok
            ? `閲覧・編集とも なし／攻撃欄=${labels.join("・")}（名前=${namePlaceholder}）`
            : `生キー: ${[...leaked].slice(0, 5).join(", ") || "なし"} 攻撃欄のラベル${labels.length}件（空${blank}）名前=${namePlaceholder || "空"}`,
        };
      },
      TAG,
    ),
  );

  await check("怪異の攻撃カードが 判定→ダメージ と進む（D4の自由式）", () =>
    assertInPage(
      page,
      async (tag) => {
        const kai = game.actors.getName(`${tag}_kai`);
        const msg = await kai.useKaiAttack(0);
        const id = msg.id;
        await window.__waitFor(() => game.messages.get(id), { label: "怪異の攻撃カードの作成" });

        // 出した時点では何も振っていない。押す前に判定のボタンだけが出ている
        const fresh = game.messages.get(id).system;
        if (fresh.successCount !== null || fresh.damageTotal !== null) {
          return { ok: false, detail: "カードを出しただけで振られている" };
        }
        if (!fresh.buttons.canRollAttack || fresh.buttons.canRollDamage) {
          return { ok: false, detail: `押す前のボタン: ${JSON.stringify(fresh.buttons)}` };
        }

        // update のたびにモデルは作り直されるので、毎回メッセージから取り直す
        await window.__cardAction(game.messages.get(id), "rollAttack");
        const afterAttack = await window.__waitFor(
          () => {
            const sys = game.messages.get(id).system;
            return sys.successCount === null ? null : sys;
          },
          { soft: true, label: "判定の成功数" },
        );
        if (!afterAttack) return { ok: false, detail: "判定のあとも successCount が null" };

        await window.__cardAction(game.messages.get(id), "rollDamage");
        await window.__waitFor(() => game.messages.get(id).system.damageTotal !== null, {
          soft: true,
          label: "ダメージの反映",
        });

        const card = game.messages.get(id);
        // alwaysHit（出目1）なので各D4=1。ダメージ式 @successd4+3 は成功数個のD4＋3になり、
        // damageTotal === 成功数 + 3 が成り立てば @success の差し替えと D4 の評価が効いている
        const ok =
          card.type === "kaiAttack" &&
          afterAttack.successCount > 0 &&
          card.system.damageTotal === afterAttack.successCount + 3 &&
          card.rolls.length === 2 &&
          card.system.buttons.canApplyDamage;
        return {
          ok,
          detail: `成功数${afterAttack.successCount} ダメージ${card.system.damageTotal}（成功数D4+3, D4=1） 判定+ダメージ${card.rolls.length}本`,
        };
      },
      TAG,
    ),
  );

  await check("判定なしの攻撃は固定成功数で出て、ダメージだけ振れる", () =>
    assertInPage(
      page,
      async (tag) => {
        const kai = game.actors.getName(`${tag}_kai`);
        const msg = await kai.useKaiAttack(1);
        const id = msg.id;
        await window.__waitFor(() => game.messages.get(id), { label: "怪異の攻撃カードの作成" });

        // judgeless は振るものが無いので、固定成功数3が最初から入って出る
        const fresh = game.messages.get(id).system;
        if (fresh.successCount !== 3 || fresh.buttons.canRollAttack) {
          return {
            ok: false,
            detail: `成功数${fresh.successCount} ボタン${JSON.stringify(fresh.buttons)}`,
          };
        }

        await window.__cardAction(game.messages.get(id), "rollDamage");
        await window.__waitFor(() => game.messages.get(id).system.damageTotal !== null, {
          soft: true,
          label: "ダメージの反映",
        });

        const card = game.messages.get(id);
        // ダメージ "1" の1本だけが載る。判定を振っていないので rolls[0] はダメージで、
        // 位置で解釈すると判定として読まれる。描いた見出しと、番号を決める getter の両方を見る
        const headings = [
          ...new Set([...card.content.matchAll(/roll-label">\s*([^<]+?)\s*</g)].map((m) => m[1])),
        ];
        const ok =
          card.system.damageTotal === 1 &&
          card.rolls.length === 1 &&
          headings.length === 1 &&
          headings[0] === game.i18n.localize("EMOKLORE.ChatMessage.kaiAttack.Damage") &&
          card.system.attackRoll === undefined &&
          card.system.damageRoll === card.rolls[0];
        return {
          ok,
          detail: `成功数${card.system.successCount}(固定) ダメージ${card.system.damageTotal} ロール${card.rolls.length}本 見出し=${headings.join("・") || "なし"} 判定ロール=${card.system.attackRoll === undefined ? "なし" : "あり"}`,
        };
      },
      TAG,
    ),
  );

  await check("ダメージ式が空の攻撃はダメージのボタンが出ない", () =>
    assertInPage(
      page,
      async (tag) => {
        const kai = game.actors.getName(`${tag}_kai`);
        const msg = await kai.useKaiAttack(2);
        const id = msg.id;
        await window.__waitFor(() => game.messages.get(id), { label: "怪異の攻撃カードの作成" });

        await window.__cardAction(game.messages.get(id), "rollAttack");
        await window.__waitFor(() => game.messages.get(id).system.successCount !== null, {
          soft: true,
          label: "判定の成功数",
        });

        const card = game.messages.get(id);
        const ok = card.system.successCount > 0 && !card.system.buttons.canRollDamage;
        return {
          ok,
          detail: `成功数${card.system.successCount} ボタン${JSON.stringify(card.system.buttons)}`,
        };
      },
      TAG,
    ),
  );

  // 外れる出目に固定して「命中しなければダメージを振れない」を見る。触った設定は必ず戻す
  await pinDice(page, DICE.alwaysMiss);
  await check("命中しなければダメージを振れない", () =>
    assertInPage(
      page,
      async (tag) => {
        const kai = game.actors.getName(`${tag}_kai`);
        const msg = await kai.useKaiAttack(0);
        const id = msg.id;
        await window.__waitFor(() => game.messages.get(id), { label: "怪異の攻撃カードの作成" });

        await window.__cardAction(game.messages.get(id), "rollAttack");
        await window.__waitFor(() => game.messages.get(id).system.successCount !== null, {
          soft: true,
          label: "判定の成功数",
        });

        const card = game.messages.get(id);
        const ok = card.system.successCount <= 0 && !card.system.buttons.canRollDamage;
        return {
          ok,
          detail: `成功数${card.system.successCount} ボタン${JSON.stringify(card.system.buttons)}`,
        };
      },
      TAG,
    ),
  );
  await pinDice(page, DICE.alwaysHit);

  await check("怪異カードにも武器カードと同じ適用ボタンが配線されている", () =>
    assertInPage(page, () => {
      const kai = CONFIG.ChatMessage.dataModels.kaiAttack;
      const weapon = CONFIG.ChatMessage.dataModels.weapon;
      // 適用の2つは実体を共有する。名前だけ揃えて別物を指していないことを見る
      const shared = ["applyDamage", "applyDamageWithReduction"].filter(
        (name) => kai.ACTIONS[name] && kai.ACTIONS[name] === weapon.ACTIONS[name],
      );
      const own = ["rollAttack", "rollDamage"].filter((name) => !!kai.ACTIONS[name]);
      return {
        ok: shared.length === 2 && own.length === 2,
        detail: `共有=${shared.join(",") || "なし"} 固有=${own.join(",") || "なし"}`,
      };
    }),
  );

  await check("怪異の固定イニシアチブが既定基準（@initiative）で解決する", () =>
    assertInPage(
      page,
      async (tag) => {
        const kai = game.actors.getName(`${tag}_kai`);
        const roll = new Roll("@initiative", kai.getRollData());
        await roll.evaluate();
        return { ok: roll.total === 6, detail: `@initiative → ${roll.total}` };
      },
      TAG,
    ),
  );

  await check("怪異の装甲がダメージを軽減する", () =>
    assertInPage(
      page,
      async (tag) => {
        const kai = game.actors.getName(`${tag}_kai`);
        const before = kai.system.resources.hp.value;
        const change = await kai.applyDamage(10);
        // 10 - 装甲5 = 5 だけ減る
        const ok = change.before === before && change.after === before - 5;
        return { ok, detail: `HP ${change.before} → ${change.after}（10 - 装甲5）` };
      },
      TAG,
    ),
  );

  await check("怪異シートに共鳴感情の表示と共鳴要求ボタンが出る", () =>
    assertInPage(
      page,
      async (tag) => {
        const sheet = game.actors.getName(`${tag}_kai`).sheet;
        if (!sheet.rendered) await sheet.render(true);
        await window.__setMode(sheet, "play");
        const el = sheet.element;
        const hasButton = !!el.querySelector("[data-action=requestResonance]");
        const emotionsText = el.querySelector(".em-kai__emotions")?.textContent.trim() ?? "";
        // 感情が翻訳済みで出ている（生キーでも空でもない）
        const emotionShown = emotionsText.length > 0 && !emotionsText.includes("EMOKLORE.");
        return {
          ok: hasButton && emotionShown,
          detail: `要求ボタン=${hasButton} 感情表示=${emotionShown ? emotionsText : "なし"}`,
        };
      },
      TAG,
    ),
  );

  await check("npcのプレイ画面は未修得（Lv.0）技能を隠す", () =>
    assertInPage(
      page,
      async (tag) => {
        const sheet = game.actors.getName(`${tag}_npc`).sheet;
        if (!sheet.rendered) await sheet.render(true);
        // 通常技能の行は data-roll-type=skill。プレイ/編集を跨いで数えられる
        const count = () => sheet.element.querySelectorAll("[data-roll-type=skill]").length;
        await window.__setMode(sheet, "play");
        const play = count();
        await window.__setMode(sheet, "edit");
        const edit = count();
        await window.__setMode(sheet, "play");
        const all = Object.keys(CONFIG.EMOKLORE.skills).length;
        // フィクスチャは search だけ Lv.2。プレイは修得済みのみ、編集は全技能
        const ok = edit === all && play > 0 && play < edit;
        return { ok, detail: `閲覧${play} → 編集${edit}（全${all}）` };
      },
      TAG,
    ),
  );

  await check("npc・kaiのHP/MPを閲覧モードで直接減らせる", () =>
    assertInPage(
      page,
      async (tag) => {
        const results = [];
        for (const type of ["npc", "kai"]) {
          const sheet = game.actors.getName(`${tag}_${type}`).sheet;
          if (!sheet.rendered) await sheet.render(true);
          await window.__setMode(sheet, "play");

          // 卓中に減っていく値なので、閲覧モードでも入力でなければならない
          const inputs = ["hp", "mp"].map((key) =>
            sheet.element.querySelector(`input[name="system.resources.${key}.value"]`),
          );
          if (inputs.some((input) => !input)) {
            return { ok: false, detail: `${type}: 閲覧モードに現在値の入力が無い` };
          }
          results.push(`${type}=${inputs.map((input) => input.value).join("/")}`);
        }
        return { ok: true, detail: results.join(" ") };
      },
      TAG,
    ),
  );

  await check("kaiの最大値は編集モードだけで入力できる", () =>
    assertInPage(
      page,
      async (tag) => {
        const sheet = game.actors.getName(`${tag}_kai`).sheet;
        if (!sheet.rendered) await sheet.render(true);
        const maxInput = () =>
          !!sheet.element.querySelector('input[name="system.resources.hp.max"]');

        await window.__setMode(sheet, "play");
        const play = maxInput();
        await window.__setMode(sheet, "edit");
        const edit = maxInput();
        await window.__setMode(sheet, "play");

        return { ok: !play && edit, detail: `最大値の入力 閲覧=${play} 編集=${edit}` };
      },
      TAG,
    ),
  );

  await check("npcの基本技能は選んだものだけが閲覧モードに出る", () =>
    assertInPage(
      page,
      async (tag) => {
        const actor = game.actors.getName(`${tag}_npc`);
        const sheet = actor.sheet;
        if (!sheet.rendered) await sheet.render(true);
        const before = [...actor.system.shownBaseSkills];

        try {
          // 何も選ばれていなければ、基本技能の見出しごと出ない
          await actor.update({ "system.shownBaseSkills": [] });
          await window.__setMode(sheet, "play");
          const empty = sheet.element.querySelectorAll("[data-roll-type=base-skill]").length;

          // 編集モードは選ぶ場所なので、選択によらず13件すべてを出す
          await window.__setMode(sheet, "edit");
          const boxes = sheet.element.querySelectorAll('[data-action="toggleBaseSkill"]').length;

          // 1つ選ぶと、その1つだけがチップで並ぶ
          await actor.update({ "system.shownBaseSkills": ["negotiations"] });
          await window.__setMode(sheet, "play");
          const chips = sheet.element.querySelectorAll(
            ".em-chip[data-roll-type=base-skill]",
          ).length;

          const all = Object.keys(CONFIG.EMOKLORE.baseSkills).length;
          const ok = empty === 0 && boxes === all && chips === 1;
          return {
            ok,
            detail: `未選択${empty}件 ／ 編集のチェック${boxes}/${all} ／ 1件選択→${chips}件`,
          };
        } finally {
          await actor.update({ "system.shownBaseSkills": before });
          await window.__setMode(sheet, "play");
        }
      },
      TAG,
    ),
  );

  await check("npcのHP/MPが共鳴者と同じアイコンで出る", () =>
    assertInPage(
      page,
      async (tag) => {
        const sheet = game.actors.getName(`${tag}_npc`).sheet;
        if (!sheet.rendered) await sheet.render(true);
        const el = sheet.element;
        const hp = !!el.querySelector(".em-npc__resource-icon.fa-heart");
        const mp = !!el.querySelector(".em-npc__resource-icon.fa-wand-magic-sparkles");
        // 「現在」の生ラベルは出ていない（アイコンに置き換えた）
        const noLabel = !(el.querySelector(".em-npc__resources")?.textContent ?? "").includes(
          "現在",
        );
        return {
          ok: hp && mp && noLabel,
          detail: `HP=fa-heart:${hp} MP=fa-wand-magic-sparkles:${mp} 「現在」なし=${noLabel}`,
        };
      },
      TAG,
    ),
  );

  await check("npc・kaiのシート本体がスクロールできる", () =>
    assertInPage(
      page,
      async (tag) => {
        const results = [];
        for (const [type, sel] of [
          ["npc", ".em-npc"],
          ["kai", ".em-kai"],
        ]) {
          const sheet = game.actors.getName(`${tag}_${type}`).sheet;
          if (!sheet.rendered) await sheet.render(true);
          // 編集モードは全項目が出て確実にはみ出す。枠を小さくして溢れさせる
          await window.__setMode(sheet, "edit");
          await sheet.setPosition({ height: 220 });
          const part = sheet.element.querySelector(sel);
          await window.__waitFor(() => part.scrollHeight > part.clientHeight + 4, {
            soft: true,
            label: `${type}のはみ出し`,
          });
          const overflowY = getComputedStyle(part).overflowY;
          const scrolls =
            (overflowY === "auto" || overflowY === "scroll") &&
            part.scrollHeight > part.clientHeight + 4;
          results.push(
            `${type}=${scrolls}(${overflowY} ${part.scrollHeight}>${part.clientHeight})`,
          );
          await window.__setMode(sheet, "play");
          if (!scrolls) return { ok: false, detail: results.join(" ") };
        }
        return { ok: true, detail: results.join(" ") };
      },
      TAG,
    ),
  );

  // ラベルは systemFields から引く。**綴りを間違えると空文字になる** — Handlebars は
  // 無い値を黙って空で返すので、未解決キーの検査（生の `EMOKLORE.…` を探す）では拾えない
  await check("npc・怪異のラベルがスキーマから引けている", () =>
    assertInPage(
      page,
      async (tag) => {
        const empty = [];
        const seen = [];
        for (const [type, targets] of [
          ["npc", [".em-npc__resource"]],
          ["kai", [".em-kai__stat", ".em-kai__field"]],
        ]) {
          const sheet = game.actors.getName(`${tag}_${type}`).sheet;
          if (!sheet.rendered) await sheet.render(true);
          await window.__setMode(sheet, "edit");

          for (const selector of targets) {
            for (const row of sheet.element.querySelectorAll(selector)) {
              // ラベルは行の先頭の span（怪異）か、tooltip（NPCはアイコンだけなので）
              const text = row.querySelector("span")?.textContent?.trim() ?? "";
              const tooltip = row.dataset.tooltip ?? "";
              const label = tooltip || text;
              seen.push(label);
              if (!label) empty.push(`${type} ${selector}`);
            }
          }
          await window.__setMode(sheet, "play");
        }

        return {
          ok: empty.length === 0 && seen.length > 0,
          detail:
            empty.length === 0
              ? `${seen.length}件すべてラベルあり（${seen.slice(0, 4).join(" / ")}…）`
              : `空のラベル: ${empty.join(", ")}`,
        };
      },
      TAG,
    ),
  );

  // 行の開く・消すはアクターシートの基底が持つ。行の解決を data-item-id の手辿りではなく
  // getEmbeddedDocument に任せているので、data-document-class が付いていないと何も起きない
  await check("npcの武器行を開けて消せる", () =>
    assertInPage(
      page,
      async (tag) => {
        const actor = game.actors.getName(`${tag}_npc`);
        const sheet = actor.sheet;
        if (!sheet.rendered) await sheet.render(true);
        await window.__setMode(sheet, "edit");

        const item = actor.itemTypes.weapon[0];
        const row = () => sheet.element.querySelector(`.em-npc__weapon[data-item-id="${item.id}"]`);

        row().querySelector("[data-action=viewDoc]").click();
        await window.__waitFor(() => item.sheet?.rendered, { label: "武器シートの表示" });
        const opened = item.sheet.rendered;
        await item.sheet.close();

        row().querySelector("[data-action=deleteDoc]").click();
        await window.__waitFor(() => !actor.items.get(item.id), { label: "武器の削除" });
        await window.__waitFor(() => !row(), { label: "行の消失" });

        await window.__setMode(sheet, "play");

        return {
          ok: opened && !actor.items.get(item.id),
          detail: opened ? "開く→武器シート / 消す→行ごと消えた" : "武器シートが開かなかった",
        };
      },
      TAG,
    ),
  );
}
