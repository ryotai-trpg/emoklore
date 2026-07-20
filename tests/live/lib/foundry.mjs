// FoundryVTT本体の起動とログイン。
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { DEV_DATA, FOUNDRY_APP, ORIGIN, PORT, USER, WORLD } from "./config.mjs";

/**
 * 前提が整っているかを先に見る。
 *
 * 足りないまま進むと、Chromeのタイムアウトなど遠い場所で失敗して原因が分からなくなる。
 */
export function preflight() {
  const problems = [];
  if (!existsSync(join(FOUNDRY_APP, "main.mjs"))) {
    problems.push(`FOUNDRY_APP に main.mjs が無い: ${FOUNDRY_APP}`);
  }
  if (!existsSync(DEV_DATA)) {
    problems.push(`FVTT_DEV_DATA が無い: ${DEV_DATA}`);
  }
  if (!existsSync(join(DEV_DATA, "Data/worlds", WORLD))) {
    problems.push(`ワールドが無い: ${join(DEV_DATA, "Data/worlds", WORLD)}`);
  }
  if (!existsSync(join(DEV_DATA, "Data/systems/emoklore"))) {
    problems.push(
      `システムが配置されていない: ${join(DEV_DATA, "Data/systems/emoklore")}\n` +
        `    リポジトリの dist/ へのsymlinkを張る`,
    );
  }
  if (PORT === 30000) {
    problems.push("FVTT_PORT が 30000。メイン環境のポートなので使わない");
  }
  if (problems.length > 0) {
    console.error(`実機検証の前提が整っていない:\n  - ${problems.join("\n  - ")}`);
    process.exit(1);
  }
}

export function build() {
  const result = spawnSync("npm", ["run", "build"], {
    encoding: "utf-8",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    console.error(result.stdout ?? "", result.stderr ?? "");
    console.error("ビルドに失敗したので検証を中止する");
    process.exit(1);
  }
}

export async function startFoundry() {
  const child = spawn(
    process.execPath,
    [join(FOUNDRY_APP, "main.mjs"), `--dataPath=${DEV_DATA}`, `--port=${PORT}`, `--world=${WORLD}`],
    { stdio: "ignore" },
  );

  for (let i = 0; i < 300; i++) {
    try {
      const res = await fetch(ORIGIN, { redirect: "manual" });
      if (res.status < 500) return child;
    } catch {
      // まだ上がっていない
    }
    if (child.exitCode !== null) {
      throw new Error(`Foundryが起動直後に終了した（exit ${child.exitCode}）`);
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  child.kill();
  throw new Error(`Foundryが${PORT}で応答しない`);
}

export async function joinAsUser(page) {
  await page.nav(`${ORIGIN}/join`);

  const users = await page.eval(() =>
    [...document.querySelectorAll("select[name=userid] option")]
      .map((o) => [o.value, o.textContent.trim()])
      .filter(([v]) => v),
  );
  const match = users.find(([, name]) => name === USER) ?? users[0];
  if (!match) throw new Error("joinページにユーザーが1人もいない");

  await page.eval((id) => {
    const s = document.querySelector("select[name=userid]");
    s.value = id;
    s.dispatchEvent(new Event("change", { bubbles: true }));
    document.querySelector("button[name=join]").click();
  }, match[0]);

  for (let i = 0; i < 200; i++) {
    if (await page.eval(() => globalThis.game?.ready === true)) return match[1];
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`${USER} でログインしたが game.ready にならない`);
}
