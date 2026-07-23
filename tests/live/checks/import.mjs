// キャラクター取り込み。貼り付けたJSONが欠けていても壊れないかを見る。
import { IMPORTED_NAME, TAG } from "../lib/config.mjs";

export const title = "取り込み";

/** 取り込みダイアログを開き、JSONを貼って実行する。結果は呼び出し側が見る */
const submitJson = async (page, json) =>
  page.eval(
    async (tag, payload) => {
      const a = game.actors.getName(`${tag}_import`);
      const open = a.sheet.options.actions?.importCharacter;
      if (!open) return { error: "importCharacter アクションが無い" };

      await a.sheet.render(true);
      await window.__waitFor(() => a.sheet.rendered, { label: "取り込み先シートの描画" });
      await open.call(a.sheet, new Event("click"), null);

      const dlg = await window.__waitFor(
        () =>
          [...foundry.applications.instances.values()].find(
            (x) => x.constructor.name === "CharSheetImportDialog",
          ),
        { soft: true, label: "取り込みダイアログ" },
      );
      if (!dlg) return { error: "取り込みダイアログが開かない" };

      const ta = dlg.element.querySelector("textarea");
      const btn = [...dlg.element.querySelectorAll("button")].find(
        (b) => b.dataset.action === "import",
      );
      ta.value = payload;
      ta.dispatchEvent(new Event("input", { bubbles: true }));

      const errsBefore = window.__unexpectedErrors().length;
      const notesBefore = window.__notes.length;
      const nameBefore = a.name;
      btn.click();

      // 取り込みが通れば名前が変わり、弾かれれば通知が出る。例外が出た場合も拾う
      await window.__waitFor(
        () =>
          a.name !== nameBefore ||
          window.__notes.length > notesBefore ||
          window.__unexpectedErrors().length > errsBefore,
        { soft: true, label: "取り込みの完了" },
      );

      // この検証が出させた通知は想定内なので印を付ける（総合チェックが拾わないように）
      const notes = window.__expectNotesSince(notesBefore);
      const result = {
        name: a.name,
        renamed: a.name !== nameBefore,
        hp: a.system.resources.hp.value,
        errors: window.__unexpectedErrors().slice(errsBefore),
        notes: notes.map((n) => `${n.type}: ${n.message.trim()}`),
      };
      if (dlg.rendered) await dlg.close();
      // 名前が変わったままだと後続の検証がアクターを引けないので戻す
      if (result.renamed) await a.update({ name: `${tag}_import` });
      return result;
    },
    TAG,
    json,
  );

export async function run({ page, check }) {
  await check("params を持たないJSONでも例外にならない", async () => {
    // data.params を配列チェックなしで回すと、ここで TypeError になる
    const json = JSON.stringify({
      kind: "character",
      data: { name: IMPORTED_NAME, status: [{ label: "HP", value: 9, max: 9 }] },
    });
    const r = await submitJson(page, json);
    if (r.error) throw new Error(r.error);
    if (r.errors.length > 0) throw new Error(`例外が出た: ${JSON.stringify(r.errors)}`);
    if (!r.renamed) throw new Error(`名前が取り込まれていない: ${r.name}`);
    return `name=${IMPORTED_NAME} HP=${r.hp}`;
  });

  await check("壊れたJSONは通知で弾かれ、例外にならない", async () => {
    const r = await submitJson(page, "{これはJSONではない");
    if (r.error) throw new Error(r.error);
    // 「握り潰さず、しかし例外にもしない」がここで見たいこと。
    // 通知が出ないなら黙って失敗している
    if (r.errors.length > 0) throw new Error(`例外が出た: ${JSON.stringify(r.errors)}`);
    if (r.renamed) throw new Error("壊れたJSONなのに取り込まれてしまった");
    if (!r.notes.some((n) => n.startsWith("error"))) {
      throw new Error(`エラー通知が出ていない: ${JSON.stringify(r.notes)}`);
    }
    return r.notes.join(" / ");
  });
}
