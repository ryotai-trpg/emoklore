// docs/roadmap.md の箇条書きが引くIssueの状態をGitHub APIと突き合わせる。
// クローズ済みのIssueを引く行が [x] でなければ exit 1（オープンなのに [x] も同じ）。
// 落ちたときに直す先はコードではなく docs/roadmap.md の側になる
//
// 唯一、外部の状態に依存するチェック（roadmap以外は check:issue-refs が見る）。
// APIに到達できないとき（オフライン・レート制限）は落とさずスキップし、
// pre-commit をネットワークに依存させない。CIでは GITHUB_TOKEN（issues: read）を
// 渡してレート制限を避ける
import { readFileSync } from "node:fs";
import { fetchIssueStates } from "./issue-state.mjs";

const DOC = "docs/roadmap.md";

// 対象は箇条書きの行だけ。本文の段落でIssueに触れるのは履歴・経緯の説明なので見ない
const items = [];
readFileSync(DOC, "utf-8")
  .split("\n")
  .forEach((line, index) => {
    const marker = /^\s*[-*]\s+(\[[xX ]\]\s+)?/.exec(line);
    if (!marker) return;
    const checked = /\[[xX]\]/.test(marker[1] ?? "");
    for (const ref of line.matchAll(/#(\d+)\b/g)) {
      items.push({ line: index + 1, text: line.trim(), number: Number(ref[1]), checked });
    }
  });

if (items.length === 0) {
  console.log("roadmap OK: Issueを引く箇条書きが無い");
  process.exit(0);
}

const numbers = [...new Set(items.map((item) => item.number))];
const { repo, states, unreachable } = await fetchIssueStates(numbers);

if (unreachable.length > 0) {
  console.warn(
    `GitHub APIに到達できなかったので ${unreachable.length}件をスキップ: ${unreachable.join(", ")}`,
  );
}

const problems = [];
for (const { line, text, number, checked } of items) {
  const state = states.get(number);
  if (state === "closed" && !checked) {
    problems.push(
      `${DOC}:${line} #${number} はクローズ済みなのに未完了として引いている\n    ${text}`,
    );
  } else if (state === "open" && checked) {
    problems.push(`${DOC}:${line} #${number} はまだオープンなのに [x] が付いている\n    ${text}`);
  } else if (state === "missing") {
    problems.push(`${DOC}:${line} #${number} は ${repo} に存在しない\n    ${text}`);
  }
}

if (problems.length > 0) {
  console.error(`ロードマップとIssueの状態が食い違う: ${problems.length}件`);
  for (const entry of problems) console.error(`  - ${entry}`);
  console.error(`直す先はコードではなく ${DOC}。完了した行は [x] にし、済んだ参照は整理する`);
  process.exit(1);
}
// 「照合していないのに緑」を OK と読ませない。スキップはスキップと言う
if (states.size === 0) {
  console.log("roadmap SKIP: GitHub APIに到達できず、1件も照合していない");
} else {
  const verified = items.filter((item) => states.has(item.number)).length;
  console.log(
    `roadmap OK: ${verified}件のIssue参照が状態と一致（照合 ${states.size}/${numbers.length}件）`,
  );
}
