// lang/ja.json（正）と lang/en.json のキー整合をチェックする
// ja.json にあって en.json にないキー、en.json にしか残っていないキーを検出したら exit 1
import { readFileSync } from "node:fs";

const flatten = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value !== null && typeof value === "object" ? flatten(value, path) : [path];
  });

const ja = new Set(flatten(JSON.parse(readFileSync("lang/ja.json", "utf-8"))));
const en = new Set(flatten(JSON.parse(readFileSync("lang/en.json", "utf-8"))));

const missing = [...ja].filter((key) => !en.has(key));
const extra = [...en].filter((key) => !ja.has(key));

if (missing.length > 0) {
  console.error(`en.json に不足しているキー（ja.json が正）: ${missing.length}件`);
  for (const key of missing) console.error(`  - ${key}`);
}
if (extra.length > 0) {
  console.error(`en.json にだけ残っているキー（ja.json から消えた？）: ${extra.length}件`);
  for (const key of extra) console.error(`  - ${key}`);
}

if (missing.length + extra.length > 0) process.exit(1);
console.log(`lang OK: ja.json と en.json のキーが一致（${ja.size}件）`);
