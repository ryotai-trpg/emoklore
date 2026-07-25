// ハウリング反応（Item）。共鳴判定がトリプル以上だったときに共鳴表から引く先で、
// 引いた結果は共鳴者の持ち物になる。
//
// 回復判定の技能を「経路:キー」で持つ形が保存・choices・表示の3方向で噛み合っているか、
// ハウリング発生から表を引いて反応を乗せるまでが一周するかを見る。
import { TAG } from "../lib/config.mjs";
import { assertInPage, DICE, pinDice } from "../lib/harness.mjs";

export const title = "ハウリング反応";

/**
 * 検証で使う反応1件。汎用共鳴表「因縁タイプ」の 0009 精神汚染に相当する形。
 *
 * 効果はアイテム側に置く（transfer）。適用＝アイテムを作る、回復＝アイテムを消す、が
 * そのまま効果の付け外しになることを、この1件で確かめる。
 */
const REACTION = {
  type: "howling",
  system: {
    category: "attunement",
    effect: "<p>判定値に【精神】を使用する技能での判定は成功数-1される。</p>",
    recovery: {
      note: "",
      skills: ["base:self", "skill:psychology"],
    },
    notes: "<p>フレーバー</p>",
  },
  effects: [
    {
      name: "精神汚染",
      // mode 2 = ADD
      changes: [{ key: "system.characteristics.mentality.mod.success", mode: 2, value: "-1" }],
      transfer: true,
    },
  ],
};

export async function run({ page, check }) {
  await check("ハウリング反応シートが描画される", () =>
    assertInPage(
      page,
      async (tag, reaction) => {
        const actor = game.actors.getName(`${tag}_char`);
        const [item] = await actor.createEmbeddedDocuments("Item", [
          { ...reaction, name: `${tag}_精神汚染` },
        ]);

        await item.sheet.render(true);
        await window.__waitFor(() => item.sheet.rendered && item.sheet.element, {
          label: "ハウリング反応シートの描画",
        });
        await window.__setMode(item.sheet, "play");

        const el = item.sheet.element;
        const expected = Object.keys(item.sheet.constructor.PARTS);
        const missing = expected.filter(
          (part) => !el.querySelector(`[data-application-part="${part}"]`),
        );
        const leaked = window.__findUnresolvedKeys(el);
        const text = el.textContent;

        await item.sheet.close();

        if (missing.length > 0) {
          return { ok: false, detail: `描かれていないパート: ${missing.join(", ")}` };
        }
        if (leaked.length > 0) {
          return { ok: false, detail: `未解決の翻訳キー: ${[...new Set(leaked)].join(", ")}` };
        }
        // 分類は表示だけに使う値なので、翻訳済みで出ていることまで見る
        if (!text.includes("同調")) {
          return { ok: false, detail: "分類の表示名が出ていない" };
        }
        return { ok: true, detail: `${expected.length}パート（${expected.join(" ")}）分類=同調` };
      },
      TAG,
      REACTION,
    ),
  );

  await check("回復判定の技能は経路つきで保存され、表示は印つきになる", () =>
    assertInPage(
      page,
      async (tag) => {
        const actor = game.actors.getName(`${tag}_char`);
        const item = actor.items.getName(`${tag}_精神汚染`);

        // 保存データは「経路:キー」のまま。キーだけでは通常技能と基本技能を区別できない
        const saved = item.toObject().system.recovery.skills;

        await item.sheet.render(true);
        await window.__waitFor(() => item.sheet.rendered && item.sheet.element, {
          label: "ハウリング反応シートの描画",
        });
        await window.__setMode(item.sheet, "play");
        const text = item.sheet.element.textContent;
        await item.sheet.close();

        // 基本技能には ＊ が付く。印は判定カードやシートの表記と同じ綴り
        const shown = text.includes("＊自我／心理");
        const ok = saved.length === 2 && saved.includes("base:self") && shown;

        return {
          ok,
          detail: ok
            ? `保存=${saved.join(",")} 表示=＊自我／心理`
            : `保存=${JSON.stringify(saved)} 印つき表示=${shown}`,
        };
      },
      TAG,
    ),
  );

  await check("編集モードでは choices がそのまま複数選択になる", () =>
    assertInPage(
      page,
      async (tag) => {
        const actor = game.actors.getName(`${tag}_char`);
        const item = actor.items.getName(`${tag}_精神汚染`);

        await item.sheet.render(true);
        await window.__waitFor(() => item.sheet.rendered && item.sheet.element, {
          label: "ハウリング反応シートの描画",
        });
        await window.__setMode(item.sheet, "edit");

        const field = item.sheet.element.querySelector('[name="system.recovery.skills"]');
        // 本体の createMultiSelectInput は value に選択中の値の配列を持つ
        const selected = field ? [...(field.value ?? [])] : [];
        const leaked = window.__findUnresolvedKeys(item.sheet.element);

        await item.sheet.close();

        const ok =
          !!field &&
          selected.length === 2 &&
          selected.includes("base:self") &&
          selected.includes("skill:psychology") &&
          leaked.length === 0;

        return {
          ok,
          detail: ok
            ? `選択中=${selected.join(",")}`
            : `field=${!!field} 選択中=${JSON.stringify(selected)} 生キー: ${[...new Set(leaked)].join(",")}`,
        };
      },
      TAG,
    ),
  );

  await check("表に無い技能は choices が弾く", () =>
    assertInPage(
      page,
      async (tag) => {
        const actor = game.actors.getName(`${tag}_char`);
        const item = actor.items.getName(`${tag}_精神汚染`);

        let threw = false;
        try {
          await item.update({ "system.recovery.skills": ["skill:__nope"] });
        } catch (_error) {
          threw = true;
        }

        // 拒否されるか、少なくとも表に無い値が残らないこと
        const remains = item.system.recovery.skills.has("skill:__nope");
        const ok = !remains;

        return {
          ok,
          detail: ok
            ? threw
              ? "作成時に例外で拒否された"
              : "値が残らなかった"
            : "表に無いキーが保存された",
        };
      },
      TAG,
    ),
  );

  // 出目1固定＝クリティカル。共鳴値2で2ダイス＝成功数4になり、トリプル以上が必ず出る
  await pinDice(page, DICE.alwaysHit);

  await check("ハウリング発生から共鳴表を引ける", () =>
    assertInPage(
      page,
      async (tag, reaction) => {
        const findDialog = () =>
          [...foundry.applications.instances.values()].find(
            (x) => x.constructor.name.includes("Dialog") && x.rendered,
          );

        // 配り物に近い形で組む。共鳴表はワールドのItemを document 結果で指す
        const world = await Item.implementation.create({ ...reaction, name: `${tag}_共振` });
        const table = await foundry.documents.RollTable.implementation.create({
          name: `${tag}_共鳴表`,
          // 引き切らない表にする。1D6で何度でも引くのが共鳴表なので replacement は true
          replacement: true,
          formula: "1d1",
          results: [{ type: "document", documentUuid: world.uuid, range: [1, 1] }],
        });

        const kai = game.actors.getName(`${tag}_kai`);
        await kai.update({ "system.resonanceTable": table.uuid });

        const actor = game.actors.getName(`${tag}_char`);
        await actor.update({ "system.resources.resonance.value": 2 });

        // 誰で振るかを固定する。選択中のトークンが先に当たるので、担当を決めてから解除する
        const previous = game.user.character;
        await game.user.update({ character: actor.id });
        for (const token of [...(canvas?.tokens?.controlled ?? [])]) token.release();

        // 怪異シートから要求を出すと kaiUuid が付き、結果カードから表を辿れる
        await kai.sheet.render(true);
        await window.__setMode(kai.sheet, "play");
        kai.sheet.element.querySelector("[data-action=requestResonance]").click();

        const dlg = await window.__waitFor(findDialog, { label: "要求作成ダイアログ" });
        const form = dlg.element.querySelector("form") ?? dlg.element;
        form.elements.namedItem("intensity").value = "9";

        let before = game.messages.size;
        dlg.element.querySelector("button[data-action=ok]").click();
        await window.__waitFor(() => game.messages.size > before, { label: "要求カード" });
        await kai.sheet.close();

        const request = game.messages.contents.at(-1);
        const requestCard = await window.__waitFor(
          () => document.querySelector(`[data-message-id="${request.id}"] .em-resonance-request`),
          { label: "要求カードの描画" },
        );

        before = game.messages.size;
        requestCard.querySelector("[data-action=rollResonance]").click();
        await window.__waitFor(() => game.messages.size >= before + 2, { label: "判定と結果" });

        const outcome = game.messages.contents.at(-1);
        const drawButton = await window.__waitFor(
          () =>
            document.querySelector(`[data-message-id="${outcome.id}"] [data-action=drawHowling]`),
          { label: "共鳴表を引くボタン" },
        );

        before = game.messages.size;
        drawButton.click();
        await window.__waitFor(() => game.messages.size > before, { label: "反応カード" });

        const drawn = game.messages.contents.at(-1);
        await game.user.update({ character: previous?.id ?? null });

        const ok =
          outcome.system.howling === true &&
          drawn.type === "howlingDraw" &&
          drawn.system.itemUuid === world.uuid &&
          drawn.system.actorUuid === actor.uuid &&
          drawn.system.category === "attunement" &&
          drawn.rolls.length === 1;

        return {
          ok,
          detail: ok
            ? `成功数${outcome.system.successCount} → 「${drawn.system.reactionName}」を引いた（${drawn.rolls.length}ロール添付）`
            : `type=${drawn.type} item=${drawn.system.itemUuid} actor=${drawn.system.actorUuid} 分類=${drawn.system.category}`,
        };
      },
      TAG,
      REACTION,
    ),
  );

  await check("引いた反応を適用すると効果が乗り、外すと消える", () =>
    assertInPage(
      page,
      async (tag) => {
        const actor = game.actors.getName(`${tag}_char`);
        const drawn = game.messages.contents.findLast((m) => m.type === "howlingDraw");

        const applyButton = await window.__waitFor(
          () =>
            document.querySelector(`[data-message-id="${drawn.id}"] [data-action=applyHowling]`),
          { label: "適用ボタン" },
        );

        // 前の検証で作った反応がまだ乗っているので、絶対値ではなく差分で見る
        const baseline = actor.system.characteristics.mentality.mod.success;

        const before = actor.items.filter((i) => i.type === "howling").length;
        applyButton.click();
        await window.__waitFor(
          () => actor.items.filter((i) => i.type === "howling").length > before,
          { label: "反応アイテムの作成" },
        );

        const applied = actor.items.find((i) => i.type === "howling" && i.name === `${tag}_共振`);
        // アイテムに付いた効果（transfer）がそのまま共鳴者に乗る
        const withEffect = actor.system.characteristics.mentality.mod.success;

        await applied.delete();
        const afterDelete = actor.system.characteristics.mentality.mod.success;

        // ワールドに作った共鳴表と反応は fixtures の後片付け（アクターとシーンだけ）に
        // 乗らないので、ここで消す
        for (const doc of [
          game.items.getName(`${tag}_共振`),
          game.tables.getName(`${tag}_共鳴表`),
        ]) {
          await doc?.delete();
        }

        const ok = !!applied && withEffect === baseline - 1 && afterDelete === baseline;

        return {
          ok,
          detail: ok
            ? `適用で【精神】の成功数 ${baseline} → ${withEffect}、削除で戻った`
            : `applied=${!!applied} 基準=${baseline} 適用中=${withEffect} 削除後=${afterDelete}`,
        };
      },
      TAG,
    ),
  );
}
