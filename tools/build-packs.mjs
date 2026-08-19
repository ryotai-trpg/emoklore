// packs/src の JSON をコンペンディウム（LevelDB）にビルドする。
//
// LevelDBはディレクトリごと1つのデータベースで、テキストとしてgitに置けない。だから
// **正はJSON、成果物はビルドで作る**という形にしてある（draw-steel と同じ）。
// `vite-plugin-static-copy` では作れないので、viteのビルドとは別の経路になる。
//
//   npm run build:packs
//
// `packs/src/<パック名>/*.json` が `dist/packs/<パック名>` になる。
//
// パック名が `system.json` の `packs[].name` と揃っていないとFoundryが空のパックを
// 開き、`_key`（`!items!<id>` / `!tables!<id>`。埋め込みは `!items.effects!<親id>.<id>`
// など）の無いJSONは compilePack が黙って飛ばす。どちらも「壊れているのにビルドは
// 成功する」形になるので、コンパイルの前に検査して落とす
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { compilePack } from "@foundryvtt/foundryvtt-cli";

const SRC = "packs/src";
const DEST = "dist/packs";

const packs = readdirSync(SRC, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const declared = JSON.parse(readFileSync("system.json", "utf-8")).packs.map((pack) => pack.name);
const undeclared = packs.filter((name) => !declared.includes(name));
const missingDirs = declared.filter((name) => !packs.includes(name));
const missingKeys = [];
for (const name of packs) {
  for (const file of readdirSync(join(SRC, name)).filter((f) => f.endsWith(".json"))) {
    const source = JSON.parse(readFileSync(join(SRC, name, file), "utf-8"));
    if (typeof source._key !== "string") missingKeys.push(join(SRC, name, file));
  }
}

if (undeclared.length > 0)
  console.error(`system.json の packs に無いパック: ${undeclared.join(", ")}`);
if (missingDirs.length > 0)
  console.error(`system.json が宣言しているのに ${SRC} に無いパック: ${missingDirs.join(", ")}`);
if (missingKeys.length > 0) {
  console.error(`_key の無いJSON（compilePack が黙って飛ばす）: ${missingKeys.length}件`);
  for (const file of missingKeys) console.error(`  - ${file}`);
}
if (undeclared.length + missingDirs.length + missingKeys.length > 0) process.exit(1);

for (const name of packs) {
  const files = readdirSync(join(SRC, name)).filter((file) => file.endsWith(".json"));
  await compilePack(join(SRC, name), join(DEST, name));
  console.log(`packed ${name}: ${files.length}件`);
}

console.log(`packs OK: ${packs.length}パック`);
