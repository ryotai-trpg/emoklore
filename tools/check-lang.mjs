// lang/ja.json（正）と lang/en.json のキー整合をチェックする
// ja.json にあって en.json にないキー、en.json にしか残っていないキー、
// 2ファイルでキーの並び順が違う箇所を検出したら exit 1
import { readFileSync } from "node:fs";

const flatten = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value !== null && typeof value === "object" ? flatten(value, path) : [path];
  });

const jaKeys = flatten(JSON.parse(readFileSync("lang/ja.json", "utf-8")));
const enKeys = flatten(JSON.parse(readFileSync("lang/en.json", "utf-8")));
const ja = new Set(jaKeys);
const en = new Set(enKeys);

const missing = jaKeys.filter((key) => !en.has(key));
const extra = enKeys.filter((key) => !ja.has(key));

// 並び順まで見るのは、2ファイルを並べて読めるようにするため。キーが1つずれるだけで
// 以降の全行がずれ、diffが「同じ位置の対訳」として読めなくなる
const misordered =
  missing.length + extra.length === 0 ? jaKeys.filter((key, index) => key !== enKeys[index]) : [];

if (missing.length > 0) {
  console.error(`en.json に不足しているキー（ja.json が正）: ${missing.length}件`);
  for (const key of missing) console.error(`  - ${key}`);
}
if (extra.length > 0) {
  console.error(`en.json にだけ残っているキー（ja.json から消えた？）: ${extra.length}件`);
  for (const key of extra) console.error(`  - ${key}`);
}
if (misordered.length > 0) {
  console.error(`en.json のキーの並びが ja.json と違う: ${misordered.length}件`);
  // 先頭のずれだけ出す。1つ動かせば以降は連鎖して直ることが多い
  console.error(
    `  - 最初のずれ: ja=${misordered[0]} / en=${enKeys[jaKeys.indexOf(misordered[0])]}`,
  );
}

if (missing.length + extra.length + misordered.length > 0) process.exit(1);
console.log(`lang OK: ja.json と en.json のキーが一致（${ja.size}件、並び順も一致）`);
