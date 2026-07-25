// DLからの判定要求。チャット欄のボタン → ダイアログ → カード → 押した人のアクターで振る、
// までを実際の経路で通す。検証はGamemasterで入るのでPL側の権限の挙動は見ない。
import { TAG } from "../lib/config.mjs";
import { assertInPage } from "../lib/harness.mjs";

export const title = "判定要求";

export async function run({ page, check }) {
  await check("チャット欄にDL用の要求ボタンが1つだけ出る", () =>
    assertInPage(page, async () => {
      const found = await window.__waitFor(
        () => document.querySelectorAll("#chat-controls .em-request-skill"),
        { label: "要求ボタン" },
      );
      return {
        ok: found.length === 1,
        detail: found.length === 1 ? "1つだけ出ている" : `${found.length}個`,
      };
    }),
  );

  await check("要求を出すとベース技能が併記されたカードになる", () =>
    assertInPage(page, async () => {
      const findDialog = () =>
        [...foundry.applications.instances.values()].find((x) =>
          x.constructor.name.includes("Dialog"),
        );

      document.querySelector("#chat-controls .em-request-skill").click();
      const dlg = await window.__waitFor(findDialog, { label: "要求作成ダイアログ" });

      // 〈検索〉だけを選ぶ。ベース技能の併記は既定でオンなので〈＊調査〉が足される
      const form = dlg.element.querySelector("form") ?? dlg.element;
      form.querySelector('option[value="skill:search"]').selected = true;
      form.querySelector('[name="requiredSuccess"]').value = "2";
      form.querySelector('[name="bonus"]').value = "2";

      const before = game.messages.size;
      dlg.element.querySelector("button[data-action=ok]").click();
      await window.__waitFor(() => game.messages.size > before, { label: "要求カード" });

      const message = game.messages.contents.at(-1);
      const card = await window.__waitFor(
        () => document.querySelector(`[data-message-id="${message.id}"] .em-skill-request`),
        { label: "要求カードの描画" },
      );

      const labels = [...card.querySelectorAll("[data-action=rollRequested]")].map((b) =>
        b.textContent.trim(),
      );
      const leaked = window.__findUnresolvedKeys(card);
      const ok =
        message.type === "skillRequest" &&
        message.system.skills.length === 2 &&
        message.system.skills[1].key === "investigation" &&
        labels[1].includes("＊") &&
        card.textContent.includes("ダブル成功以上") &&
        leaked.length === 0;

      return {
        ok,
        detail: ok
          ? `${labels.join(" / ")} 条件つき 未解決キーなし`
          : `type=${message.type} ${labels.join(" / ")} 条件=${card.querySelector(".em-skill-request__terms").textContent.replace(/\s+/g, " ").trim()} 生キー: ${leaked.join(", ")}`,
      };
    }),
  );

  await check("カードのボタンが押した人のアクターで振る", () =>
    assertInPage(
      page,
      async (tag) => {
        const actor = game.actors.getName(`${tag}_char`);
        const message = game.messages.contents.findLast((m) => m.type === "skillRequest");
        const card = document.querySelector(`[data-message-id="${message.id}"] .em-skill-request`);

        // トークンを選ばずに、担当キャラクターだけで決まることを見る。選択は
        // 前のチェックが残していることがあるので、空になるまで待ってから進む
        const previous = game.user.character;
        await game.user.update({ character: actor.id });
        // 選択解除は担当を決めたあとに行う。担当の割り当てで本体がトークンを掴み直す
        for (const token of [...(canvas?.tokens?.controlled ?? [])]) token.release();
        await window.__waitFor(() => (canvas?.tokens?.controlled ?? []).length === 0, {
          soft: true,
          timeout: 1000,
          label: "トークンの選択解除",
        });
        const acting = game.user.character?.name;
        const stillControlled = (canvas?.tokens?.controlled ?? []).map((t) => t.actor?.name);

        const before = game.messages.size;
        card.querySelector("[data-action=rollRequested]").click();
        await window.__waitFor(() => game.messages.size > before, { label: "判定のメッセージ" });

        const rolled = game.messages.contents.at(-1);
        const roll = rolled.rolls[0];
        await game.user.update({ character: previous?.id ?? null });

        const level = actor.system.skills.search.level;
        const ok =
          rolled.speaker.actor === actor.id &&
          roll.dmFormula.startsWith(`(${level}+2)DM≦`) &&
          roll.requiredSuccess === 2;

        return {
          ok,
          detail: `${roll.dmFormula} 要求${roll.requiredSuccess} 発言者=${rolled.speaker.alias}（担当=${acting} 選択[${stillControlled.join(",")}]）`,
        };
      },
      TAG,
    ),
  );

  await check("振るアクターが決まらなければ通知して振らない", () =>
    assertInPage(page, async () => {
      const message = game.messages.contents.findLast((m) => m.type === "skillRequest");
      const card = document.querySelector(`[data-message-id="${message.id}"] .em-skill-request`);

      // 担当キャラクターを外し、選択も解く。DLは所有アクターへ落とさないので決まらない
      const previous = game.user.character;
      await game.user.update({ character: null });
      for (const token of [...(canvas?.tokens?.controlled ?? [])]) token.release();
      await window.__waitFor(() => (canvas?.tokens?.controlled ?? []).length === 0, {
        soft: true,
        timeout: 1000,
        label: "トークンの選択解除",
      });

      const noteFrom = window.__notes.length;
      const before = game.messages.size;
      card.querySelector("[data-action=rollRequested]").click();

      // 「振らないこと」の確認なので、増えるのを待って時間切れになるのが正常
      const rolled =
        (await window.__waitFor(
          () => (game.messages.size > before ? game.messages.size - before : null),
          { soft: true, timeout: 1000, label: "判定のメッセージ" },
        )) ?? 0;
      const notes = window.__expectNotesSince(noteFrom);
      await game.user.update({ character: previous?.id ?? null });

      const ok = rolled === 0 && notes.some((n) => n.type === "warning");
      return {
        ok,
        detail: ok ? "0件・通知あり" : `${rolled}件 通知[${notes.map((n) => n.type).join(",")}]`,
      };
    }),
  );
}
