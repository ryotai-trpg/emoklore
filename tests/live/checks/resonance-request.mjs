// DLからの共鳴判定・憑依判定の要求。怪異シート → 要求カード → 振る → 共鳴値の上昇と
// ハウリング検知まで。一致度の決め方そのものは単体テストが持つ。
//
// ダイスは出目1固定（クリティカル）なので、共鳴値ぶんのダイスはすべて成功数2になる。
import { TAG } from "../lib/config.mjs";
import { assertInPage } from "../lib/harness.mjs";

export const title = "共鳴判定の要求";

export async function run({ page, check }) {
  await check("怪異シートから要求カードが出る", () =>
    assertInPage(
      page,
      async (tag) => {
        const findDialog = () =>
          [...foundry.applications.instances.values()].find(
            (x) => x.constructor.name.includes("Dialog") && x.rendered,
          );

        const kai = game.actors.getName(`${tag}_kai`);
        await kai.sheet.render(true);
        await window.__setMode(kai.sheet, "play");
        kai.sheet.element.querySelector("[data-action=requestResonance]").click();

        const dlg = await window.__waitFor(findDialog, { label: "要求作成ダイアログ" });
        const form = dlg.element.querySelector("form") ?? dlg.element;
        // 怪異のプリセット（強度5・上昇1・自己顕示）が初期値に入っている
        const preset = {
          intensity: form.elements.namedItem("intensity").value,
          rise: form.elements.namedItem("rise").value,
          emotion: form.elements.namedItem("emotion").value,
        };

        const before = game.messages.size;
        dlg.element.querySelector("button[data-action=ok]").click();
        await window.__waitFor(() => game.messages.size > before, { label: "要求カード" });

        const message = game.messages.contents.at(-1);
        const card = await window.__waitFor(
          () => document.querySelector(`[data-message-id="${message.id}"] .em-resonance-request`),
          { label: "要求カードの描画" },
        );
        const leaked = window.__findUnresolvedKeys(card);
        await kai.sheet.close();

        const ok =
          preset.intensity === "5" &&
          preset.rise === "1" &&
          preset.emotion === "selfAssertion" &&
          message.type === "resonanceRequest" &&
          message.system.kaiUuid === kai.uuid &&
          leaked.length === 0;

        return {
          ok,
          detail: ok
            ? `強度${preset.intensity} 上昇${preset.rise} ${preset.emotion} 怪異の参照つき`
            : `${JSON.stringify(preset)} type=${message.type} kai=${message.system.kaiUuid} 生キー: ${leaked.join(",")}`,
        };
      },
      TAG,
    ),
  );

  await check("カードのボタンで振ると共鳴値が上がる", () =>
    assertInPage(
      page,
      async (tag) => {
        // 誰で振るかを固定する。選択中のトークンが先に当たるので、担当を決めてから解除する
        const useActor = async (target) => {
          await game.user.update({ character: target.id });
          for (const token of [...(canvas?.tokens?.controlled ?? [])]) token.release();
          await window.__waitFor(() => (canvas?.tokens?.controlled ?? []).length === 0, {
            soft: true,
            timeout: 1000,
            label: "トークンの選択解除",
          });
        };

        const actor = game.actors.getName(`${tag}_char`);
        // 共鳴値1・感情なしにして、一致なし＝1ダイス＝成功数2（クリティカル）にする
        await actor.update({
          "system.resources.resonance.value": 1,
          "system.emotions.surface": "",
          "system.emotions.hidden": "",
          "system.emotions.root": "",
        });

        const previous = game.user.character;
        await useActor(actor);

        const message = game.messages.contents.findLast((m) => m.type === "resonanceRequest");
        const card = document.querySelector(
          `[data-message-id="${message.id}"] .em-resonance-request`,
        );

        const before = game.messages.size;
        card.querySelector("[data-action=rollResonance]").click();
        // 判定のロールと結果カードの2件が出る
        await window.__waitFor(() => game.messages.size >= before + 2, { label: "判定と結果" });

        const outcome = game.messages.contents.at(-1);
        await game.user.update({ character: previous?.id ?? null });

        const ok =
          outcome.type === "resonanceOutcome" &&
          outcome.system.rise === 1 &&
          outcome.system.before === 1 &&
          outcome.system.after === 2 &&
          actor.system.resources.resonance.value === 2;

        return {
          ok,
          detail: `Lv.${outcome.system.before}→${outcome.system.after}（+${outcome.system.rise}） 成功数${outcome.system.successCount}`,
        };
      },
      TAG,
    ),
  );

  await check("トリプル以上でハウリング発生が出る", () =>
    assertInPage(
      page,
      async (tag) => {
        const findDialog = () =>
          [...foundry.applications.instances.values()].find(
            (x) => x.constructor.name.includes("Dialog") && x.rendered,
          );

        // 誰で振るかを固定する。選択中のトークンが先に当たるので、担当を決めてから解除する
        const useActor = async (target) => {
          await game.user.update({ character: target.id });
          for (const token of [...(canvas?.tokens?.controlled ?? [])]) token.release();
          await window.__waitFor(() => (canvas?.tokens?.controlled ?? []).length === 0, {
            soft: true,
            timeout: 1000,
            label: "トークンの選択解除",
          });
        };

        const actor = game.actors.getName(`${tag}_char`);
        // 共鳴値2なら2ダイス＝成功数4でトリプル以上。上昇値はダイス式で受ける
        await actor.update({ "system.resources.resonance.value": 2 });
        const previous = game.user.character;
        await useActor(actor);

        document.querySelector("#chat-controls .em-request-resonance").click();
        const dlg = await window.__waitFor(findDialog, { label: "要求作成ダイアログ" });
        const form = dlg.element.querySelector("form") ?? dlg.element;
        form.elements.namedItem("intensity").value = "9";
        form.elements.namedItem("rise").value = "1d3";

        let before = game.messages.size;
        dlg.element.querySelector("button[data-action=ok]").click();
        await window.__waitFor(() => game.messages.size > before, { label: "要求カード" });

        const request = game.messages.contents.at(-1);
        const card = await window.__waitFor(
          () => document.querySelector(`[data-message-id="${request.id}"] .em-resonance-request`),
          { label: "要求カードの描画" },
        );

        before = game.messages.size;
        card.querySelector("[data-action=rollResonance]").click();
        await window.__waitFor(() => game.messages.size >= before + 2, { label: "判定と結果" });

        const outcome = game.messages.contents.at(-1);
        const shown = document.querySelector(
          `[data-message-id="${outcome.id}"] .em-resonance-outcome__notice`,
        );
        await game.user.update({ character: previous?.id ?? null });

        const ok =
          outcome.system.successCount >= 3 && outcome.system.howling === true && Boolean(shown);
        return {
          ok,
          detail: `成功数${outcome.system.successCount} ハウリング=${outcome.system.howling} 上昇+${outcome.system.rise}（1d3）`,
        };
      },
      TAG,
    ),
  );

  await check("憑依判定は成否によらず+1でハウリングが出ない", () =>
    assertInPage(
      page,
      async (tag) => {
        const findDialog = () =>
          [...foundry.applications.instances.values()].find(
            (x) => x.constructor.name.includes("Dialog") && x.rendered,
          );

        // 誰で振るかを固定する。選択中のトークンが先に当たるので、担当を決めてから解除する
        const useActor = async (target) => {
          await game.user.update({ character: target.id });
          for (const token of [...(canvas?.tokens?.controlled ?? [])]) token.release();
          await window.__waitFor(() => (canvas?.tokens?.controlled ?? []).length === 0, {
            soft: true,
            timeout: 1000,
            label: "トークンの選択解除",
          });
        };

        const actor = game.actors.getName(`${tag}_char`);
        const resonance = actor.system.resources.resonance.value;
        const previous = game.user.character;
        await useActor(actor);

        document.querySelector("#chat-controls .em-request-resonance").click();
        const dlg = await window.__waitFor(findDialog, { label: "要求作成ダイアログ" });
        const form = dlg.element.querySelector("form") ?? dlg.element;
        // 強度1なら出目1のクリティカルだけが通る。上昇値は読まれないはず
        form.elements.namedItem("intensity").value = "9";
        form.elements.namedItem("rise").value = "3";
        form.elements.namedItem("possessionMode").checked = true;

        let before = game.messages.size;
        dlg.element.querySelector("button[data-action=ok]").click();
        await window.__waitFor(() => game.messages.size > before, { label: "要求カード" });

        const request = game.messages.contents.at(-1);
        const card = await window.__waitFor(
          () => document.querySelector(`[data-message-id="${request.id}"] .em-resonance-request`),
          { label: "要求カードの描画" },
        );
        const heading = card.querySelector(".em-resonance-request__head").textContent.trim();

        before = game.messages.size;
        card.querySelector("[data-action=rollResonance]").click();
        await window.__waitFor(() => game.messages.size >= before + 2, { label: "判定と結果" });

        const outcome = game.messages.contents.at(-1);
        const mentality = actor.system.characteristics.mentality.value;
        await game.user.update({ character: previous?.id ?? null });

        const ok =
          heading.includes("憑依") &&
          outcome.system.rise === 1 &&
          outcome.system.after === resonance + 1 &&
          outcome.system.howling === false &&
          outcome.system.possessionReached === outcome.system.successCount >= mentality;

        return {
          ok,
          detail: `${heading} +${outcome.system.rise} ハウリング=${outcome.system.howling} 【精神】${mentality}に対し成功数${outcome.system.successCount}→到達=${outcome.system.possessionReached}`,
        };
      },
      TAG,
    ),
  );
}
