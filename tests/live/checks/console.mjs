// 総合。ここまでの操作でエラーや警告が出ていないかを最後にまとめて見る。
import { assertInPage } from "../lib/harness.mjs";

export const title = "総合";

export async function run({ page, check }) {
  await check("コンソールエラーと警告通知が無い", () =>
    assertInPage(page, () => {
      // 通知で説明のつくものは差し引く。ui.notifications.error() は本体が
      // console にも流すので、正しく警告している場面まで拾ってしまう
      const errs = window.__unexpectedErrors();
      // error と warning だけを見る。info は通常運転でも出る。
      // 検証が意図して出させた通知（印付き）は除く
      const notes = window.__notes
        .filter((n) => !n.expected && (n.type === "error" || n.type === "warning"))
        .map((n) => `${n.type}: ${n.message}`);
      const ok = errs.length === 0 && notes.length === 0;
      return {
        ok,
        detail: ok
          ? `なし（通知${window.__notes.length}件はいずれも想定内）`
          : `エラー${JSON.stringify(errs)} 通知${JSON.stringify(notes)}`,
      };
    }),
  );
}
