// system.json の manifest / download のURLが規約どおりかチェックする
//
// この2つは役割が違い、間違えても手元では何も起きず、配ったあとに壊れる。
//
// - manifest … Foundryが更新確認で毎回引くURL。**動くポインタでなければならない**。
//   タグ固定にすると、そのバージョンを入れた人はいつまでも同じ中身を見ることになり、
//   `isNewerVersion(remote.version, installed.version)` が永久に偽になって更新が届かない
// - download … 更新を実行するときにzipを取るURL。**リモートのマニフェストのほう**が
//   読まれる（本体の dist/packages/views.mjs の installPackage）。latest にすると
//   マニフェストとzipで latest を別々に2回解決することになり、そのあいだに新しい
//   Releaseが出ると「古いマニフェストで新しいzipを入れる」がありうる。タグに固定して
//   version と揃えておけば、必ず同じRelease由来になる
import { readFileSync } from "node:fs";

const REPO = "https://github.com/ryotai-trpg/emoklore";

const system = JSON.parse(readFileSync("system.json", "utf-8"));
const { version, manifest, download } = system;

const expectedManifest = `${REPO}/releases/latest/download/system.json`;
const expectedDownload = `${REPO}/releases/download/${version}/dist.zip`;

const problems = [];

if (manifest !== expectedManifest) {
  problems.push(`manifest が規約と違う\n      期待: ${expectedManifest}\n      実際: ${manifest}`);
}
if (download !== expectedDownload) {
  problems.push(
    `download が version (${version}) と揃っていない\n      期待: ${expectedDownload}\n      実際: ${download}`,
  );
}

if (problems.length > 0) {
  console.error("system.json の配布URLが規約と違う（リリース手順は docs/contributing.md）:");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(`manifest urls OK: manifest は latest、download は ${version} 固定`);
