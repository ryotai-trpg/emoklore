// foundry-config.yaml の installPath から foundry/client・foundry/common のsymlinkを作る
// 型チェック（tsconfigの @client/* / @common/* パス解決）が本体ソースを参照するための準備
// foundry-config.yaml が無い環境（CI・本体未所持）では何もせず正常終了する
import { existsSync, lstatSync, mkdirSync, readFileSync, symlinkSync, unlinkSync } from "node:fs";
import { join } from "node:path";

if (!existsSync("foundry-config.yaml")) {
  console.log(
    "foundry-config.yaml がありません（example-foundry-config.yaml をコピーして作成）。symlink作成をスキップしました",
  );
  process.exit(0);
}

// installPath: "..." の1行だけを想定した簡易パース（js-yaml非依存）
const config = {};
for (const line of readFileSync("foundry-config.yaml", "utf-8").split("\n")) {
  const match = line.match(/^(\w+):\s*(.+?)\s*$/);
  if (!match) continue;
  let value = match[2];
  if (/^".*"$/.test(value)) value = value.slice(1, -1).replaceAll("\\\\", "\\");
  else if (/^'.*'$/.test(value)) value = value.slice(1, -1);
  config[match[1]] = value;
}

if (!config.installPath) {
  console.error("foundry-config.yaml に installPath がありません");
  process.exit(1);
}

// electron配布はアプリ本体が resources/app に入れ子になっている（Node配布はルート直下）
const nested = join(config.installPath, "resources", "app");
const fileRoot = existsSync(nested) ? nested : config.installPath;

mkdirSync("foundry", { recursive: true });
for (const dir of ["client", "common"]) {
  const target = join(fileRoot, dir);
  if (!existsSync(target)) {
    console.error(`${target} がありません。installPath を確認してください`);
    process.exit(1);
  }
  const linkPath = join("foundry", dir);
  try {
    if (!lstatSync(linkPath).isSymbolicLink()) {
      console.error(`${linkPath} がsymlink以外で存在します。削除してから再実行してください`);
      process.exit(1);
    }
    unlinkSync(linkPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  symlinkSync(target, linkPath);
  console.log(`${linkPath} -> ${target}`);
}
