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

// 診断は "path(line,col): error TSxxxx: ..." で始まり、続く詳細行はインデントされる
const lines = `${tsc.stdout ?? ""}${tsc.stderr ?? ""}`.split("\n");
const isDiagnosticHead = (line) => /^\S.+: error TS\d+:/.test(line);
let keep = false;
let errorCount = 0;
const kept = [];
for (const line of lines) {
  if (isDiagnosticHead(line)) {
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
console.log("typecheck OK（foundry/ 本体ソース内の診断は除外）");
