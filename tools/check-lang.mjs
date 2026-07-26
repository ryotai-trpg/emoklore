// lang/ja.json（正）と lang/en.json の整合をチェックする。
//
// 1. ja.json にあって en.json にないキー、en.json にしか残っていないキー
// 2. 2ファイルでキーの並び順が違う箇所
// 3. 値の中のプレースホルダ（{name} など）の食い違い
//
// 値そのものは見ない。訳し忘れて日本語が残った en.json はここを通る。
import { readFileSync } from "node:fs";

const flatten = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value !== null && typeof value === "object" ? flatten(value, path) : [[path, value]];
  });

const jaEntries = flatten(JSON.parse(readFileSync("lang/ja.json", "utf-8")));
const enEntries = flatten(JSON.parse(readFileSync("lang/en.json", "utf-8")));
const jaKeys = jaEntries.map(([key]) => key);
const enKeys = enEntries.map(([key]) => key);
const ja = new Map(jaEntries);
const en = new Map(enEntries);

const missing = jaKeys.filter((key) => !en.has(key));
const extra = enKeys.filter((key) => !ja.has(key));

// 並び順まで見るのは、2ファイルを並べて読めるようにするため。キーが1つずれるだけで
// 以降の全行がずれ、diffが「同じ位置の対訳」として読めなくなる
const misordered =
  missing.length + extra.length === 0 ? jaKeys.filter((key, index) => key !== enKeys[index]) : [];

// プレースホルダが片方だけに書かれていると、展開されずに `{name}` と画面に出るか、
// 渡した値がどこにも出ない。翻訳のときに落としやすいので機械で見る
const placeholders = (value) =>
  [...String(value).matchAll(/\{([^}]+)\}/g)].map((match) => match[1]).sort();
const mismatched =
  missing.length + extra.length === 0
    ? jaEntries.filter(([key, value]) => {
        const a = placeholders(value);
        const b = placeholders(en.get(key));
        return a.length !== b.length || a.some((name, index) => name !== b[index]);
      })
    : [];

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
if (mismatched.length > 0) {
  console.error(`プレースホルダが ja / en で食い違う: ${mismatched.length}件`);
  for (const [key, value] of mismatched) {
    console.error(`  - ${key}`);
    console.error(`      ja: ${placeholders(value).join(", ") || "（なし）"}`);
    console.error(`      en: ${placeholders(en.get(key)).join(", ") || "（なし）"}`);
  }
}

if (missing.length + extra.length + misordered.length + mismatched.length > 0) process.exit(1);
console.log(`lang OK: ja.json と en.json が一致（${ja.size}件、並び順とプレースホルダも一致）`);
