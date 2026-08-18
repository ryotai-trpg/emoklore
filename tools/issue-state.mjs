// GitHub Issue/PRの状態の問い合わせ。check:roadmap と check:issue-refs が共有する。
// リポジトリは system.json の url が正。到達できなかった番号は unreachable に積んで
// 返し、呼び出し側は落とさずスキップする（チェックをネットワークに依存させない）
import { readFileSync } from "node:fs";

// numbers（Issue/PR番号の集合）→ { repo, states: Map<number, "open"|"closed"|"missing">, unreachable }
export const fetchIssueStates = async (numbers) => {
  const { url } = JSON.parse(readFileSync("system.json", "utf-8"));
  const repo = new URL(url).pathname.replace(/^\/+|\/+$/g, "");
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;

  const fetchState = async (number) => {
    const response = await fetch(`https://api.github.com/repos/${repo}/issues/${number}`, {
      headers: {
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 404) return "missing";
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()).state; // open | closed
  };

  const list = [...numbers];
  const states = new Map();
  const unreachable = [];
  const results = await Promise.allSettled(list.map(fetchState));
  results.forEach((result, index) => {
    if (result.status === "fulfilled") states.set(list[index], result.value);
    else unreachable.push(`#${list[index]}（${result.reason?.message ?? result.reason}）`);
  });
  return { repo, states, unreachable };
};
