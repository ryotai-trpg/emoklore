// 共鳴判定の感情マッチング。感情を選ぶと一致度が自動で決まり、手で上書きもできる。
// 一致度の決め方そのものは単体テスト（emotion-match.test.ts）が持つので、
// ここで見るのはダイアログからロールまでの配線。
//
// 検証関数は文字列にしてページへ送られるので、外の変数は届かない。ダイアログを回す
// 手順は各検証の中で作り直す（skill-roll.mjs の findDialog と同じ形）。
import { TAG } from "../lib/config.mjs";
import { assertInPage } from "../lib/harness.mjs";

export const title = "感情マッチング";

export async function run({ page, check }) {
  await check("ダイアログのピッカーで感情を選べる", () =>
    assertInPage(
      page,
      async (tag) => {
        const findApp = (name) =>
          [...foundry.applications.instances.values()].find(
            (x) => x.constructor.name.includes(name) && x.rendered,
          );

        const actor = game.actors.getName(`${tag}_char`);
        await actor.sheet.render(true);
        await window.__setMode(actor.sheet, "play");
        actor.sheet.element.querySelector("[data-roll-type=resonance]").click();
        const dlg = await window.__waitFor(() => findApp("Dialog"), { label: "共鳴判定" });

        dlg.element.querySelector("[data-action=pickEmotions]").click();
        const picker = await window.__waitFor(() => findApp("EmotionPicker"), {
          label: "感情ピッカー",
        });
        // 複数選択モードなので2つ選べる。押し直しで外れることもここで見る
        picker.element.querySelector("[data-emotion=hope]").click();
        picker.element.querySelector("[data-emotion=anger]").click();
        picker.element.querySelector("[data-emotion=anger]").click();
        picker.element.querySelector("[data-emotion=regret]").click();
        // グリッド側にも選択中がタグで出る
        await window.__waitFor(() => picker.element.querySelectorAll(".tags .tag").length === 2, {
          label: "ピッカーのタグ",
        });
        picker.element.querySelector("button[type=submit]").click();
        await window.__waitFor(() => !findApp("EmotionPicker"), { label: "ピッカーが閉じる" });

        const form = dlg.element.querySelector("form") ?? dlg.element;
        const value = form.elements.namedItem("emotions").value;
        // 表示は本体と同じタグ。長い名前が並んでも折り返せる形になっている
        const tags = [...dlg.element.querySelectorAll(".em-emotion-field .tag")].map((t) =>
          t.querySelector("span").textContent.trim(),
        );

        // タグの×で外すと hidden も一緒に減る
        dlg.element.querySelector(".em-emotion-field .tag[data-key=regret] .remove").click();
        await window.__waitFor(() => form.elements.namedItem("emotions").value === "hope", {
          label: "タグの削除",
        });
        const afterRemove = [...dlg.element.querySelectorAll(".em-emotion-field .tag")].length;

        await dlg.close();
        await window.__waitFor(() => !findApp("Dialog"), { soft: true, label: "ダイアログ" });

        const ok =
          value === "hope,regret" &&
          tags.join("／") === "希望（理想）／後悔（傷）" &&
          afterRemove === 1;
        return { ok, detail: `${value} → タグ[${tags.join(" ")}] → ×で${afterRemove}件` };
      },
      TAG,
    ),
  );

  await check("一致度が指定された感情から自動で決まる", () =>
    assertInPage(
      page,
      async (tag) => {
        const findDialog = () =>
          [...foundry.applications.instances.values()].find(
            (x) => x.constructor.name.includes("Dialog") && x.rendered,
          );
        const actor = game.actors.getName(`${tag}_char`);
        const rollWith = async (emotions, choice) => {
          actor.sheet.element.querySelector("[data-roll-type=resonance]").click();
          const dlg = await window.__waitFor(findDialog, { label: "共鳴判定のダイアログ" });

          const form = dlg.element.querySelector("form") ?? dlg.element;
          form.elements.namedItem("intensity").value = "5";
          form.elements.namedItem("emotions").value = emotions;
          form.querySelector(`[name=choice][value=${choice}]`).checked = true;

          const before = game.messages.size;
          dlg.element.querySelector("button[data-action=ok]").click();
          await window.__waitFor(() => game.messages.size > before, { label: "共鳴判定" });
          await window.__waitFor(() => !findDialog(), { soft: true, label: "ダイアログが閉じる" });

          return game.messages.contents.at(-1).rolls[0].dmFormula;
        };

        // 共鳴値3、表=希望（理想） 裏=怒り（情念） ルーツ=後悔（傷）
        await actor.update({
          "system.resources.resonance.value": 3,
          "system.emotions.surface": "hope",
          "system.emotions.hidden": "anger",
          "system.emotions.root": "regret",
          "system.emotions.acquired": ["fear"],
        });

        // 完全一致は3種の枠と追加取得のどれでも成立し、ダイス数が2倍になる。
        // ルーツ属性一致（孤独＝傷）は+1、どの属性とも重ならない所有（欲望）は素通し
        const results = {
          裏: await rollWith("anger", "auto"),
          追加取得: await rollWith("fear", "auto"),
          ルーツ属性: await rollWith("loneliness", "auto"),
          一致なし: await rollWith("possession", "auto"),
          // 《怪異》が複数の感情で鳴らすケース。どれか1つでも一致すれば成立する
          複数指定: await rollWith("possession,anger", "auto"),
        };
        await actor.update({ "system.emotions.acquired": [] });

        const expected = {
          裏: "6DM≦5",
          追加取得: "6DM≦5",
          ルーツ属性: "4DM≦5",
          一致なし: "3DM≦5",
          複数指定: "6DM≦5",
        };
        const wrong = Object.keys(expected).filter((k) => results[k] !== expected[k]);

        return {
          ok: wrong.length === 0,
          detail: Object.entries(results)
            .map(([k, v]) => `${k}=${v}`)
            .join(" "),
        };
      },
      TAG,
    ),
  );

  await check("手で選んだ一致度は自動より優先される", () =>
    assertInPage(
      page,
      async (tag) => {
        const findDialog = () =>
          [...foundry.applications.instances.values()].find(
            (x) => x.constructor.name.includes("Dialog") && x.rendered,
          );

        const actor = game.actors.getName(`${tag}_char`);
        actor.sheet.element.querySelector("[data-roll-type=resonance]").click();
        const dlg = await window.__waitFor(findDialog, { label: "共鳴判定のダイアログ" });

        // 自動なら一致なしになる感情を指定しつつ、完全一致を手で選ぶ
        const form = dlg.element.querySelector("form") ?? dlg.element;
        form.elements.namedItem("intensity").value = "5";
        form.elements.namedItem("emotions").value = "possession";
        form.querySelector("[name=choice][value=completely]").checked = true;

        const before = game.messages.size;
        dlg.element.querySelector("button[data-action=ok]").click();
        await window.__waitFor(() => game.messages.size > before, { label: "共鳴判定" });
        await window.__waitFor(() => !findDialog(), { soft: true, label: "ダイアログが閉じる" });

        const formula = game.messages.contents.at(-1).rolls[0].dmFormula;
        return { ok: formula === "6DM≦5", detail: `手動で完全一致 → ${formula}` };
      },
      TAG,
    ),
  );
}
