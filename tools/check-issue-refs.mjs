// コメントとdocs本文の Issue/PR 参照（#N）が規約に沿うかチェックする。
// 規約は docs/code-design.md「コメント」と docs/contributing.md「書き方」:
//   - オープンなIssueへの参照はよい（閉じるときに一緒に消す）
//   - 閉じた番号は書かない。コードコメントだけは「証拠: #N」の形を例外として許す
//     （docsの本文に例外は無い — 番号ではなく根拠そのものを書く）
// docs/roadmap.md は「[x] と状態の整合」という別の規則を持つので check:roadmap が見る。
// lang/*.json はUI文字列でコメントではないので対象外。
// APIに到達できないときは落とさずスキップする（check:roadmap と同じ設計）
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fetchIssueStates } from "./issue-state.mjs";

// コメント類。閉じた番号は「証拠: #N」の形だけ許す
const CODE_TREES = [
  ["module", [".ts"]],
  ["tools", [".mjs", ".ts", ".grit"]],
  ["tests", [".mjs", ".ts"]],
  ["templates", [".hbs"]],
  ["css", [".css"]],
  [".github", [".yml", ".yaml"]],
  ["docs/.vitepress", [".ts", ".mts", ".mjs"]],
];
const CODE_FILES = ["lefthook.yml", "biome.json", "vite.config.ts", "vitest.config.ts"];

// docsの本文。閉じた番号に例外は無い
const DOCS_FILES = [
  ...readdirSync("docs")
    .filter((name) => name.endsWith(".md") && name !== "roadmap.md")
    .map((name) => `docs/${name}`),
  "README.md",
  "CLAUDE.md",
];

const walk = (dir, exts, files) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) walk(entryPath, exts, files);
    else if (exts.some((ext) => entry.name.endsWith(ext))) files.push(entryPath);
  }
};

const codeFiles = [...CODE_FILES.filter((file) => existsSync(file))];
for (const [dir, exts] of CODE_TREES) {
  if (existsSync(dir)) walk(dir, exts, codeFiles);
}

// 「Issue #N」「PR #N」と裸の「#N」を拾う。ただしCSSでは数字だけの16進色と
// 区別できないので、明示の形（Issue/PR/証拠の前置き）だけを見る
const REF_RE = /(?<![\w#])(?:(Issue|PR)\s)?#(\d+)\b/g;

const refs = [];
const collect = (file, docsStrict) => {
  const explicitOnly = file.endsWith(".css");
  readFileSync(file, "utf-8")
    .split("\n")
    .forEach((text, index) => {
      for (const m of text.matchAll(REF_RE)) {
        const number = Number(m[2]);
        const evidence = text.includes(`証拠: #${number}`);
        if (explicitOnly && m[1] === undefined && !evidence) continue;
        refs.push({ file, line: index + 1, text: text.trim(), number, evidence, docsStrict });
      }
    });
};
for (const file of codeFiles) collect(file, false);
for (const file of DOCS_FILES) collect(file, true);

if (refs.length === 0) {
  console.log("issue refs OK: Issueを引くコメント・本文が無い");
  process.exit(0);
}

const numbers = [...new Set(refs.map((ref) => ref.number))];
const { repo, states, unreachable } = await fetchIssueStates(numbers);

if (unreachable.length > 0) {
  console.warn(
    `GitHub APIに到達できなかったので ${unreachable.length}件をスキップ: ${unreachable.join(", ")}`,
  );
}

const problems = [];
for (const { file, line, text, number, evidence, docsStrict } of refs) {
  const state = states.get(number);
  const at = `${file}:${line}`;
  if (state === "missing") {
    problems.push(`${at} #${number} は ${repo} に存在しない\n    ${text}`);
  } else if (state === "closed" && docsStrict) {
    problems.push(
      `${at} #${number} はクローズ済み — 本文からは消し、番号ではなく根拠そのものを書く\n    ${text}`,
    );
  } else if (state === "closed" && !evidence) {
    problems.push(
      `${at} #${number} はクローズ済み — 消して現在形の条件文にするか、証拠の置き場所なら「証拠: #${number}」と綴る\n    ${text}`,
    );
  }
}

if (problems.length > 0) {
  console.error(`Issue参照が規約に合わない: ${problems.length}件`);
  for (const entry of problems) console.error(`  - ${entry}`);
  console.error(
    "直す先は参照している側。規約は docs/code-design.md「コメント」（コード）と docs/contributing.md「書き方」（docs本文）",
  );
  process.exit(1);
}
// 「照合していないのに緑」を OK と読ませない。スキップはスキップと言う
if (states.size === 0) {
  console.log("issue refs SKIP: GitHub APIに到達できず、1件も照合していない");
} else {
  const verified = refs.filter((ref) => states.has(ref.number)).length;
  console.log(
    `issue refs OK: ${verified}件の参照が規約に適合（照合 ${states.size}/${numbers.length}件）`,
  );
}
