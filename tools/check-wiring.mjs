// package.json の check:* が pre-commit（lefthook.yml）と CI（ci.yml）の両方に
// 配線されているかチェックする。スクリプトを足して配線を忘れると、検査は存在する
// のに黙ってどこでも走らない。配線は3箇所を手で揃える持ち場なので、揃っている
// ことをここが機械で見る
import { readFileSync } from "node:fs";

const scripts = Object.keys(JSON.parse(readFileSync("package.json", "utf-8")).scripts).filter(
  (name) => name.startsWith("check:"),
);
const WIRED = [
  ["lefthook.yml", readFileSync("lefthook.yml", "utf-8")],
  [".github/workflows/ci.yml", readFileSync(".github/workflows/ci.yml", "utf-8")],
];

const problems = [];
for (const name of scripts) {
  // 前方一致の別名（check:lang と check:lang-xxx など）を同一視しないよう、
  // 名前の直後がスクリプト名の続きでないことまで見る
  const exact = new RegExp(`${name}(?![a-z-])`);
  for (const [file, source] of WIRED) {
    if (!exact.test(source)) problems.push(`${name} が ${file} に無い`);
  }
}

if (problems.length > 0) {
  console.error(`配線されていない check:* : ${problems.length}件`);
  for (const entry of problems) console.error(`  - ${entry}`);
  console.error("check:* は pre-commit（lefthook.yml）と CI（ci.yml）の両方に配線する");
  process.exit(1);
}
console.log(`wiring OK: ${scripts.length}本の check:* が pre-commit と CI の両方にある`);
