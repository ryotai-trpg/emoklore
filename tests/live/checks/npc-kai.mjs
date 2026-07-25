// 人間NPC（npc）と怪異（kai）の作成・シート描画・判定・攻撃・初速・装甲。
// 静的チェックでは通らない、種別ごとのランタイムの形を見る。
import { TAG } from "../lib/config.mjs";
import { assertInPage } from "../lib/harness.mjs";

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
          kai.system.attacks.length === 2 &&
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

  await check("怪異の攻撃が判定とダメージのカードに出る（D4の自由式）", () =>
    assertInPage(
      page,
      async (tag) => {
        const kai = game.actors.getName(`${tag}_kai`);
        const msg = await kai.rollKaiAttack(0);
        // サブタイプは update で作り直されるので id から引き直す
        const sys = game.messages.get(msg.id).system;
        // alwaysHit（出目1）なので各D4=1。ダメージ式 @successd4+3 は成功数個のD4＋3になり、
        // damageTotal === 成功数 + 3 が成り立てば @success の差し替えと D4 の評価が効いている
        const ok =
          msg.type === "kaiAttack" &&
          sys.successCount > 0 &&
          sys.damageTotal === sys.successCount + 3 &&
          msg.rolls.length === 2;
        return {
          ok,
          detail: `成功数${sys.successCount} ダメージ${sys.damageTotal}（成功数D4+3, D4=1） 判定+ダメージ${msg.rolls.length}本`,
        };
      },
      TAG,
    ),
  );

  await check("判定なしの攻撃は固定成功数でダメージまで通る", () =>
    assertInPage(
      page,
      async (tag) => {
        const kai = game.actors.getName(`${tag}_kai`);
        const msg = await kai.rollKaiAttack(1);
        const sys = game.messages.get(msg.id).system;
        // judgeless: 判定を振らず固定成功数3、ダメージ "1"、ロールはダメージ1本だけ
        const ok = sys.successCount === 3 && sys.damageTotal === 1 && msg.rolls.length === 1;
        return {
          ok,
          detail: `成功数${sys.successCount}(固定) ダメージ${sys.damageTotal} ロール${msg.rolls.length}本`,
        };
      },
      TAG,
    ),
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
}
