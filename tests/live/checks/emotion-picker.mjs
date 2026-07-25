// 共鳴感情のピッカー。5属性×47感情を一望して選び、シートへ書き戻すまでの配線を見る。
// 列の組み立てそのものは単体テスト（helpers.test.ts）が持つので、ここでは通るかどうかだけ。
//
// 検証関数は文字列にしてページへ送られるので、外の変数は届かない。ピッカーを引く道具は
// 各検証の中で作り直す（skill-roll.mjs の findDialog と同じ形）。
import { TAG } from "../lib/config.mjs";
import { assertInPage } from "../lib/harness.mjs";

export const title = "感情ピッカー";

export async function run({ page, check }) {
  await check("ピッカーが5属性の列に47感情を並べる", () =>
    assertInPage(
      page,
      async (tag) => {
        // 閉じかけのものを掴むと element が null になった瞬間に落ちる。描画済みだけを見る
        const findPicker = () =>
          [...foundry.applications.instances.values()].find(
            (app) => app.constructor.name === "EmotionPicker" && app.rendered,
          );

        const sheet = game.actors.getName(`${tag}_char`).sheet;
        await sheet.render(true);
        await window.__setMode(sheet, "edit");
        sheet.element.querySelector("[data-action=pickEmotions]").click();
        const picker = await window.__waitFor(findPicker, { label: "感情ピッカー" });

        const columns = picker.element.querySelectorAll(".em-emotion-picker__column").length;
        const emotions = picker.element.querySelectorAll("[data-emotion]").length;
        const slots = picker.element.querySelectorAll("[data-action=selectSlot]").length;
        const leaked = window.__findUnresolvedKeys(picker.element);

        await picker.close();
        await window.__waitFor(() => !findPicker(), { label: "ピッカーが閉じる" });

        const ok = columns === 5 && emotions === 47 && slots === 3 && leaked.length === 0;
        return {
          ok,
          detail: ok
            ? "5列 47感情 3枠 未解決キーなし"
            : `列${columns} 感情${emotions} 枠${slots} 生キー: ${leaked.slice(0, 3).join(", ")}`,
        };
      },
      TAG,
    ),
  );

  await check("選んで決定すると表・裏・ルーツに書き戻る", () =>
    assertInPage(
      page,
      async (tag) => {
        const findPicker = () =>
          [...foundry.applications.instances.values()].find(
            (app) => app.constructor.name === "EmotionPicker" && app.rendered,
          );
        const isPicked = (app, key) =>
          app.element.querySelector(`[data-emotion=${key}]`)?.getAttribute("aria-pressed") ===
          "true";

        const actor = game.actors.getName(`${tag}_char`);
        actor.sheet.element.querySelector("[data-action=pickEmotions]").click();
        const picker = await window.__waitFor(findPicker, { label: "感情ピッカー" });

        // 行き先は先頭の空き枠（表）から始まり、選ぶたびに次の空き枠へ進む。
        // だから3回押せば表・裏・ルーツが順に埋まる
        for (const key of ["hope", "anger", "regret"]) {
          picker.element.querySelector(`[data-emotion=${key}]`).click();
          await window.__waitFor(() => isPicked(picker, key), { label: `${key} が選ばれる` });
        }

        picker.element.querySelector("button[type=submit]").click();
        await window.__waitFor(() => actor.system.emotions.surface === "hope", {
          label: "アクターへの書き戻し",
        });
        await window.__waitFor(() => !findPicker(), { label: "ピッカーが閉じる" });

        const { surface, hidden, root } = actor.system.emotions;
        const ok = surface === "hope" && hidden === "anger" && root === "regret";
        return { ok, detail: `表=${surface} 裏=${hidden} ルーツ=${root}` };
      },
      TAG,
    ),
  );

  await check("キャンセルすると保存値が変わらない", () =>
    assertInPage(
      page,
      async (tag) => {
        const findPicker = () =>
          [...foundry.applications.instances.values()].find(
            (app) => app.constructor.name === "EmotionPicker" && app.rendered,
          );
        const isPicked = (app, key) =>
          app.element.querySelector(`[data-emotion=${key}]`)?.getAttribute("aria-pressed") ===
          "true";

        const actor = game.actors.getName(`${tag}_char`);
        const before = actor.system.emotions.surface;
        actor.sheet.element.querySelector("[data-action=pickEmotions]").click();
        const picker = await window.__waitFor(findPicker, { label: "感情ピッカー" });

        picker.element.querySelector("[data-emotion=despair]").click();
        await window.__waitFor(() => isPicked(picker, "despair"), { label: "絶望が選ばれる" });
        await picker.close();
        await window.__waitFor(() => !findPicker(), { label: "ピッカーが閉じる" });

        // 「変わらないこと」の確認なので、変わるのを待って時間切れになるのが正常
        const changed = await window.__waitFor(
          () => (actor.system.emotions.surface === before ? null : actor.system.emotions.surface),
          { soft: true, timeout: 1000, label: "キャンセル後の書き戻し" },
        );
        // 後続のチェックがこのシートを開いたまま使うので、閉じずに閲覧へ戻す
        await window.__setMode(actor.sheet, "play");

        return {
          ok: !changed,
          detail: changed ? `${before} → ${changed} に変わった` : `${before} のまま`,
        };
      },
      TAG,
    ),
  );

  await check("怪異は枠を持たず、複数選択で書き戻る", () =>
    assertInPage(
      page,
      async (tag) => {
        const findPicker = () =>
          [...foundry.applications.instances.values()].find(
            (app) => app.constructor.name === "EmotionPicker" && app.rendered,
          );
        const isPicked = (app, key) =>
          app.element.querySelector(`[data-emotion=${key}]`)?.getAttribute("aria-pressed") ===
          "true";

        const kai = game.actors.getName(`${tag}_kai`);
        const original = [...kai.system.emotions];
        const sheet = kai.sheet;
        await sheet.render(true);
        await window.__setMode(sheet, "edit");
        sheet.element.querySelector("[data-action=pickEmotions]").click();
        const picker = await window.__waitFor(findPicker, { label: "感情ピッカー" });

        // 枠のチップは出ず、すでに持っている感情は押し込まれた状態で始まる
        const noSlots = picker.element.querySelectorAll("[data-action=selectSlot]").length === 0;
        const preselected = isPicked(picker, "selfAssertion");

        picker.element.querySelector("[data-emotion=fear]").click();
        await window.__waitFor(() => isPicked(picker, "fear"), { label: "恐怖が選ばれる" });

        picker.element.querySelector("button[type=submit]").click();
        await window.__waitFor(() => kai.system.emotions.has("fear"), {
          label: "怪異への書き戻し",
        });
        await window.__waitFor(() => !findPicker(), { label: "ピッカーが閉じる" });

        const after = [...kai.system.emotions];
        const ok = noSlots && preselected && after.length === original.length + 1;

        // 後続のチェックが元の感情を前提にしているので戻す
        await kai.update({ "system.emotions": original });
        await window.__setMode(sheet, "play");

        return {
          ok,
          detail: ok
            ? `枠なし 選択済み反映 ${original.join(",")} → ${after.join(",")}`
            : `枠なし=${noSlots} 選択済み=${preselected} ${after.join(",")}`,
        };
      },
      TAG,
    ),
  );
}
