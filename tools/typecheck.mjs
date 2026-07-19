// tsc --noEmit を実行し、foundry/（FoundryVTT本体ソース）内の診断を除外して報告する
// 本体JSには this.constructor.#x などTSのバインダが解釈できない記法が少数あり、
// checkJs無効・skipLibCheckでも文法カテゴリの診断（TS1111）だけは抑制できないため
import { spawnSync } from "node:child_process";

const tsc = spawnSync("npx", ["tsc", "--noEmit", "--pretty", "false"], {
  encoding: "utf-8",
  shell: process.platform === "win32",
});
if (tsc.error) {
  console.error(`tscの起動に失敗: ${tsc.error.message}`);
  process.exit(1);
}

// ファイル単位の診断は "path(line,col): error TSxxxx: ..."、
// tsconfigの不正など全体に関わる診断は "error TSxxxx: ..." と、前置きなしで出る。
// どちらも拾わないと、後者が握り潰されて終了コードごと失われる
const output = `${tsc.stdout ?? ""}${tsc.stderr ?? ""}`;
const lines = output.split("\n");
const isDiagnosticHead = (line) =>
  /^(\S.*\(\d+,\d+\)|error TS\d+)/.test(line) && /error TS\d+:/.test(line);
let keep = false;
let headCount = 0;
let errorCount = 0;
const kept = [];
for (const line of lines) {
  if (isDiagnosticHead(line)) {
    headCount += 1;
    keep = !line.startsWith("foundry/");
    if (keep) errorCount += 1;
  }
  if (keep && line !== "") kept.push(line);
}

if (errorCount > 0) {
  console.error(kept.join("\n"));
  console.error(`型エラー: ${errorCount}件`);
  process.exit(1);
}

// tscが失敗したのに診断を1件も解釈できていない場合は、出力形式が想定外なので黙って通さない
if (tsc.status !== 0 && headCount === 0) {
  console.error(output.trim() || `tscが終了コード${tsc.status}で失敗しました`);
  console.error("tscの出力を解釈できませんでした");
  process.exit(1);
}

console.log("typecheck OK（foundry/ 本体ソース内の診断は除外）");
