// カスタム技能。Itemとして作られ、アクター側のミラー越しに判定・効果へ繋がるか。
//
// ここは「保存はItem、判定に効く値はアクターのミラー」という二段構えなので、
// どちらか片方だけ見ても意味がない。作る・振る・レベルを変える・消す のそれぞれで
// 両側が噛み合っていることを確かめる。
import { TAG } from "../lib/config.mjs";
import { assertInPage } from "../lib/harness.mjs";

export const title = "カスタム技能";

export async function run({ page, check }) {
  await check("技能アイテムを作るとミラーが揃う", () =>
    assertInPage(
      page,
      async (tag) => {
        const actor = game.actors.getName(`${tag}_char`);
        const [item] = await actor.createEmbeddedDocuments("Item", [
          {
            name: `${tag}_忍術`,
            type: "skill",
            system: {
              category: "extra",
              characteristicOptions: ["dexterity", "physical"],
              characteristic: "dexterity",
              group: "athletic",
              level: 2,
            },
          },
        ]);

        const entry = actor.system.customSkills[item.id];
        // ミラーは保存しない。保存データに出ていたら二重管理になっている
        const saved = JSON.stringify(actor.toObject().system).includes("customSkills");
        const ok =
          !!entry &&
          !saved &&
          entry.level === 2 &&
          entry.isExtra === true &&
          entry.target === 2 + actor.system.characteristics.dexterity.value;

        return {
          ok,
          detail: ok
            ? `Lv${entry.level} 目標値${entry.target}（保存データには出ない）`
            : `entry=${JSON.stringify(entry)} savedにcustomSkills=${saved}`,
        };
      },
      TAG,
    ),
  );

  await check("ベース区分はレベルを持たず能力値がそのまま目標値になる", () =>
    assertInPage(
      page,
      async (tag) => {
        const actor = game.actors.getName(`${tag}_char`);
        // レベル3を入れてもベース区分なら無視されること
        const [item] = await actor.createEmbeddedDocuments("Item", [
          {
            name: `${tag}_結界術`,
            type: "skill",
            system: {
              category: "base",
              characteristicOptions: ["intelligence"],
              characteristic: "intelligence",
              level: 3,
            },
          },
        ]);

        const entry = actor.system.customSkills[item.id];
        const expected = actor.system.characteristics.intelligence.value;
        const ok = entry.level === 1 && entry.target === expected && entry.isBase === true;

        return {
          ok,
          detail: ok
            ? `Lv${entry.level} 目標値${entry.target}（保存レベル3は無視）`
            : `Lv${entry.level} 目標値${entry.target} 期待${expected}`,
        };
      },
      TAG,
    ),
  );

  await check("シートに行が出て、区分ごとに置き場所が変わる", () =>
    assertInPage(
      page,
      async (tag) => {
        const sheet = game.actors.getName(`${tag}_char`).sheet;
        await sheet.render(true);
        await window.__waitFor(() => sheet.rendered, { label: "シートの描画" });

        await window.__setMode(sheet, "play");
        // 閲覧: 通常・エクストラは技能行、ベースは基本技能のチップ
        const playRows = sheet.element.querySelectorAll(
          ".em-skill-row a[data-roll-type=custom-skill]",
        ).length;
        const playChips = sheet.element.querySelectorAll(
          ".em-chip[data-roll-type=custom-skill]",
        ).length;

        await window.__setMode(sheet, "edit");
        // 編集: 区分によらず全部が行として出る（編集・削除の口が要るため）
        const editRows = sheet.element.querySelectorAll(".em-skill-row--custom").length;
        const controls = sheet.element.querySelectorAll(
          ".em-skill-row--custom [data-action=deleteDoc]",
        ).length;
        await window.__setMode(sheet, "play");

        const ok = playRows === 1 && playChips === 1 && editRows === 2 && controls === 2;
        return {
          ok,
          detail: ok
            ? `閲覧: 行1・チップ1／編集: 行2（削除ボタン2）`
            : `閲覧 行${playRows} チップ${playChips}／編集 行${editRows} 操作${controls}`,
        };
      },
      TAG,
    ),
  );

  await check("段入力がアイテムに書かれ、アクターには残らない", () =>
    assertInPage(
      page,
      async (tag) => {
        const actor = game.actors.getName(`${tag}_char`);
        const sheet = actor.sheet;
        const item = actor.itemTypes.skill.find((i) => i.name === `${tag}_忍術`);

        await window.__setMode(sheet, "edit");
        const radios = [
          ...sheet.element.querySelectorAll(
            `.em-skill-row--custom[data-item-id="${item.id}"] input[type=radio]`,
          ),
        ];
        if (radios.length !== 3) throw new Error(`段が3つ出ていない: ${radios.length}`);

        // Lv.1 に落とす
        radios[0].click();
        await window.__waitFor(() => actor.items.get(item.id).system.level === 1, {
          label: "レベルの書き込み",
        });
        const down = actor.items.get(item.id).system.level;

        // 選択中の段をもう一度押すと未修得に戻る（組込技能と同じ操作）
        const again = [
          ...sheet.element.querySelectorAll(
            `.em-skill-row--custom[data-item-id="${item.id}"] input[type=radio]`,
          ),
        ];
        again[0].click();
        await window.__waitFor(() => actor.items.get(item.id).system.level === 0, {
          label: "未修得への戻し",
        });
        const cleared = actor.items.get(item.id).system.level;

        // 段の name はアクター側のミラーを指しているが、そこは保存しない枠
        const leaked = JSON.stringify(actor.toObject().system).includes("customSkills");
        await window.__setMode(sheet, "play");

        const ok = down === 1 && cleared === 0 && !leaked;
        return {
          ok,
          detail: ok
            ? "Lv2→1→0（アクターの保存データは汚れない）"
            : `down=${down} cleared=${cleared} leaked=${leaked}`,
        };
      },
      TAG,
    ),
  );

  await check("参照能力値の選択がアイテムに書かれ、目標値が付いてくる", () =>
    assertInPage(
      page,
      async (tag) => {
        const actor = game.actors.getName(`${tag}_char`);
        const sheet = actor.sheet;
        const item = actor.itemTypes.skill.find((i) => i.name === `${tag}_忍術`);

        await window.__setMode(sheet, "edit");
        const select = sheet.element.querySelector(
          `.em-skill-row--custom[data-item-id="${item.id}"] select[data-skill-characteristic]`,
        );
        if (!select) throw new Error("参照能力値の選択欄が出ていない（2件以上のはず）");

        const before = actor.items.get(item.id).system.characteristic;
        const next = [...select.options].map((o) => o.value).find((v) => v !== before);

        // 本体のフォームの change を _onChangeForm で拾う経路。actions（クリック）には載らない
        select.value = next;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        await window.__waitFor(() => actor.items.get(item.id).system.characteristic === next, {
          label: "参照能力値の書き込み",
        });

        const entry = actor.system.customSkills[item.id];
        const expected = entry.level + actor.system.characteristics[next].value;
        await window.__setMode(sheet, "play");

        const ok = entry.characteristic === next && entry.target === expected;
        return {
          ok,
          detail: ok
            ? `${before} → ${next}（目標値${entry.target}）`
            : `ミラー=${entry.characteristic} 目標値${entry.target} 期待${expected}`,
        };
      },
      TAG,
    ),
  );

  await check("技能名をクリックすると判定が飛び、見出しに区分の印が付く", () =>
    assertInPage(
      page,
      async (tag) => {
        const actor = game.actors.getName(`${tag}_char`);
        const sheet = actor.sheet;
        const item = actor.itemTypes.skill.find((i) => i.name === `${tag}_忍術`);
        // 前の検証が未修得（Lv.0）にしている。閲覧モードは未修得の技能を出さないので、
        // 振れる状態に戻したうえで、行が描き直されるまで待つ。
        // update も __setMode も render の完了までは待たない
        await actor.items.get(item.id).update({ "system.level": 2 });
        await window.__setMode(sheet, "play");

        const row = () =>
          sheet.element.querySelector(".em-skill-row a[data-roll-type=custom-skill]");
        const chip = () => sheet.element.querySelector(".em-chip[data-roll-type=custom-skill]");
        await window.__waitFor(() => row() && chip(), { label: "カスタム技能の行とチップ" });

        const before = game.messages.size;

        // 技能行（エクストラ）とチップ（ベース）の両方から振る
        row().click();
        await window.__waitFor(() => game.messages.size === before + 1, { label: "行からの判定" });
        chip().click();
        await window.__waitFor(() => game.messages.size === before + 2, {
          label: "チップからの判定",
        });

        const [fromRow, fromChip] = [...game.messages].slice(-2);
        const ok = fromRow.flavor.includes("★") && fromChip.flavor.includes("＊");
        return {
          ok,
          detail: ok
            ? `${fromRow.flavor} / ${fromChip.flavor}`
            : `印が付いていない: ${fromRow.flavor} / ${fromChip.flavor}`,
        };
      },
      TAG,
    ),
  );

  await check("効果がカスタム技能の判定に乗る", () =>
    assertInPage(
      page,
      async (tag) => {
        const actor = game.actors.getName(`${tag}_char`);
        const item = actor.itemTypes.skill.find((i) => i.name === `${tag}_忍術`);

        const before = (await actor.buildSkillRoll({ kind: "custom", id: item.id })).roll.dmFormula;
        const [effect] = await actor.createEmbeddedDocuments("ActiveEffect", [
          {
            name: `${tag}_忍術+3`,
            changes: [
              {
                key: `system.customSkills.${item.id}.mod.target`,
                mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                value: "3",
              },
            ],
          },
        ]);
        const after = (await actor.buildSkillRoll({ kind: "custom", id: item.id })).roll.dmFormula;
        await effect.delete();

        const ok = !before.includes("+3") && after.includes("+3");
        return { ok, detail: ok ? `${before} → ${after}` : `変わらない: ${before} → ${after}` };
      },
      TAG,
    ),
  );

  await check("効果の適用先にカスタム技能が並ぶ", () =>
    assertInPage(
      page,
      async (tag) => {
        const actor = game.actors.getName(`${tag}_char`);
        const item = actor.itemTypes.skill.find((i) => i.name === `${tag}_忍術`);
        const [effect] = await actor.createEmbeddedDocuments("ActiveEffect", [
          { name: `${tag}_選択肢`, changes: [{ key: "", mode: 2, value: "" }] },
        ]);

        await effect.sheet.render(true);
        await window.__waitFor(
          () => effect.sheet.element?.querySelector("select[data-change-key-part=target]"),
          { label: "効果シートの描画" },
        );

        const select = effect.sheet.element.querySelector("select[data-change-key-part=target]");
        const values = [...select.querySelectorAll("option")].map((o) => o.value);
        await effect.sheet.close();
        await effect.delete();

        const expected = `customSkills.${item.id}`;
        const ok = values.includes(expected);
        return { ok, detail: ok ? `${expected} が選べる` : `選択肢に無い: ${values.join(", ")}` };
      },
      TAG,
    ),
  );

  await check("技能を消すとシートからもミラーからも消える", () =>
    assertInPage(
      page,
      async (tag) => {
        const actor = game.actors.getName(`${tag}_char`);
        const sheet = actor.sheet;
        const item = actor.itemTypes.skill.find((i) => i.name === `${tag}_忍術`);
        const id = item.id;

        await window.__setMode(sheet, "edit");
        sheet.element
          .querySelector(`.em-skill-row--custom[data-item-id="${id}"] [data-action=deleteDoc]`)
          .click();
        await window.__waitFor(() => !actor.items.get(id), { label: "アイテムの削除" });
        await window.__waitFor(
          () => !sheet.element.querySelector(`.em-skill-row--custom[data-item-id="${id}"]`),
          { label: "行の消失" },
        );

        const inMirror = id in actor.system.customSkills;
        await window.__setMode(sheet, "play");

        return {
          ok: !inMirror,
          detail: !inMirror ? "行・ミラーとも消えた" : "ミラーに残っている",
        };
      },
      TAG,
    ),
  );
}
