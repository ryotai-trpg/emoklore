// packs/src の JSON をコンペンディウム（LevelDB）にビルドする。
//
// LevelDBはディレクトリごと1つのデータベースで、テキストとしてgitに置けない。だから
// **正はJSON、成果物はビルドで作る**という形にしてある（draw-steel と同じ）。
// `vite-plugin-static-copy` では作れないので、viteのビルドとは別の経路になる。
//
//   npm run build:packs
//
// `packs/src/<パック名>/*.json` が `dist/packs/<パック名>` になる。パック名は
// `system.json` の `packs[].name` と揃えること。揃っていないとFoundryが空のパックを開く。
//
// 各JSONには `_key` が要る（`!items!<id>` / `!tables!<id>`。埋め込みは
// `!items.effects!<親id>.<id>` / `!tables.results!<親id>.<id>`）。**`_key` の無い
// ファイルは黙って飛ばされる**ので、書き忘れると「1件も入らないのにビルドは成功する」。
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { compilePack } from "@foundryvtt/foundryvtt-cli";

const SRC = "packs/src";
const DEST = "dist/packs";

const packs = readdirSync(SRC, { withFileTypes: true }).filter((entry) => entry.isDirectory());

for (const { name } of packs) {
  const files = readdirSync(join(SRC, name)).filter((file) => file.endsWith(".json"));
  await compilePack(join(SRC, name), join(DEST, name));
  console.log(`packed ${name}: ${files.length}件`);
}

console.log(`packs OK: ${packs.length}パック`);
