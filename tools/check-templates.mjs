// templates/ 配下の Handlebars テンプレートを precompile して構文エラーを検出する
// （ヘルパーの解決はしない。構文の妥当性のみ）
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Handlebars from "handlebars";

const files = readdirSync("templates", { recursive: true })
  .map(String)
  .filter((file) => file.endsWith(".hbs"))
  .map((file) => join("templates", file));

let failed = 0;
for (const file of files) {
  try {
    Handlebars.precompile(readFileSync(file, "utf-8"));
  } catch (error) {
    failed++;
    console.error(`NG ${file}\n   ${error.message.split("\n")[0]}`);
  }
}

if (failed > 0) {
  console.error(`\ntemplates NG: ${failed}/${files.length} ファイルに構文エラー`);
  process.exit(1);
}
console.log(`templates OK: ${files.length}ファイルの構文チェック通過`);
