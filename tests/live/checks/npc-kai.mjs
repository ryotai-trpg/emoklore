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
}
