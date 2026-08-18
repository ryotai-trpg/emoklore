// lang/ja.json（正）と lang/en.json の整合と、値の表記をチェックする。
//
// 整合:
// 1. ja.json にあって en.json にないキー、en.json にしか残っていないキー
// 2. 2ファイルでキーの並び順が違う箇所
// 3. 値の中のプレースホルダ（{name} など）の食い違い
//
// 表記（規約は docs/code-design.md「`lang/*.json` のキー」が正）:
// 4. 禁止表記（役割名の「GM」、絵文字の無限記号、技能の印の直書き）
// 5. 途中に「。」があるのに末尾に無い文
// 6. 通知（ui.notifications）に渡すキーの ja 値が「。」で終わること
// 7. キーの形（ドットを含むキー、EMOKLORE 直下の裸のリーフ）
// 8. en.json に残った日本語（訳し忘れ）
//
// 訳の正しさまでは見ない。
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const flatten = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value !== null && typeof value === "object" ? flatten(value, path) : [[path, value]];
  });

const jaRaw = JSON.parse(readFileSync("lang/ja.json", "utf-8"));
const enRaw = JSON.parse(readFileSync("lang/en.json", "utf-8"));
const jaEntries = flatten(jaRaw);
const enEntries = flatten(enRaw);
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

// キーの形。ドットを含むキーは本体は読めるが木として辿れず、EMOKLORE 直下の
// 裸のリーフは名前空間と同じ列に文字列が並んでどちらなのか読めない。
// flatten はドットで繋ぐので区別が消える — ここだけ木のまま見る
const dotted = [];
const walkKeys = (lang, node, path) => {
  for (const [key, value] of Object.entries(node)) {
    const joined = path ? `${path}.${key}` : key;
    if (key.includes(".")) dotted.push(`[${lang}] ${joined}`);
    if (value !== null && typeof value === "object") walkKeys(lang, value, joined);
  }
};
walkKeys("ja", jaRaw, "");
walkKeys("en", enRaw, "");

const bareLeaves = [];
for (const [lang, raw] of [
  ["ja", jaRaw],
  ["en", enRaw],
]) {
  for (const [key, value] of Object.entries(raw.EMOKLORE ?? {})) {
    if (value === null || typeof value !== "object") bareLeaves.push(`[${lang}] EMOKLORE.${key}`);
  }
}

// en.json にかな・漢字が残っていたら訳し忘れ。記号（〈〉 や ＊ ★ ∞）は
// 訳語の一部として正当なので、文字種はかなと漢字だけを見る
const JAPANESE = /[々ぁ-ゖァ-ヺ一-鿿]/;
const untranslated = enEntries.filter(([, value]) => JAPANESE.test(String(value)));

/**
 * 使ってはいけない表記。
 *
 * 役割名は「ディーラー」か「DL」で、「GM」は使わない。無限記号は `∞`（U+221E）で、
 * 絵文字（U+267E）は使わない。
 */
const BANNED = [
  { pattern: /\bGM\b/, label: "「GM」（ディーラー / DL を使う）" },
  { pattern: /♾/, label: "絵文字の無限記号（∞ U+221E を使う）" },
];

const banned = [];
for (const [lang, entries] of [
  ["ja", jaEntries],
  ["en", enEntries],
]) {
  for (const [key, value] of entries) {
    for (const { pattern, label } of BANNED) {
      if (pattern.test(String(value))) banned.push({ lang, key, label, value });
    }
  }
}

/**
 * 印の落ちた基本技能名。
 *
 * 基本技能は `＊` が名前の一部で、ルールブックも常に付けて書く。`〈生存〉判定` のように
 * 印なしで書くと、同じカードの別の行（`〈＊生存〉`）と食い違う。
 *
 * **ルールブックの文をそのまま引く値もあるので、印の直書き自体は禁止しない。** 見るのは
 * 「基本技能の名前が〈〉に入っていて、印が落ちている」ことだけ。技能への参照として名前を
 * 組み立てる場所は `describeSkillLabel` を通せば印が付く。
 */
const baseSkillLabels = jaEntries
  .filter(([key]) => key.startsWith("EMOKLORE.Config.baseSkills."))
  .map(([, value]) => String(value));
const unmarked = [];
for (const [key, value] of jaEntries) {
  for (const label of baseSkillLabels) {
    if (String(value).includes(`〈${label}〉`)) unmarked.push({ key, label, value });
  }
}

// 複数の文を並べた値が、末尾だけ句点を落としているもの。日本語UIは文末に「。」を付ける
// （本体の日本語化と揃える）。1文の値は下の通知の検査で見るので、ここは複文だけを見る
const unterminated = jaEntries.filter(([, value]) => {
  const text = String(value);
  return text.slice(0, -1).includes("。") && !/[。！？]$/.test(text);
});

/**
 * `ui.notifications` に渡しているキー。
 *
 * トーストは文として読ませるものなので「。」で終える。ラベル・選択肢・プレースホルダは
 * 文ではないので対象にしない — その線をキーの名前で引くと当たらないので、**実際に
 * 通知へ渡している呼び出しから拾う**。
 *
 * **変数越しに渡しているキーは見えない**（`ui.notifications.error(validation.error)` の形）。
 * 静的に辿るなら値の追跡が要るので、そこは人が揃える。
 */
const notificationKeys = new Set();
const listTs = (dir) =>
  readdirSync(dir, { recursive: true })
    .map(String)
    .filter((file) => file.endsWith(".ts"))
    .map((file) => join(dir, file));
for (const file of listTs("module")) {
  const source = readFileSync(file, "utf-8");
  for (const [, key] of source.matchAll(
    /ui\.notifications\??\.\w+\(\s*"((?:EMOKLORE|SETTINGS)[\w.]+)"/g,
  )) {
    notificationKeys.add(key);
  }
}

const unterminatedNotice = [...notificationKeys]
  .filter((key) => ja.has(key) && !/[。！？]$/.test(String(ja.get(key))))
  .sort();

if (dotted.length > 0) {
  console.error(`ドットを含むキー（木として辿れない）: ${dotted.length}件`);
  for (const key of dotted) console.error(`  - ${key}`);
}
if (bareLeaves.length > 0) {
  console.error(`EMOKLORE 直下の裸のリーフ（名前空間の下に置く）: ${bareLeaves.length}件`);
  for (const key of bareLeaves) console.error(`  - ${key}`);
}
if (untranslated.length > 0) {
  console.error(`en.json に日本語が残っている（訳し忘れ）: ${untranslated.length}件`);
  for (const [key, value] of untranslated) console.error(`  - ${key}: ${value}`);
}
if (banned.length > 0) {
  console.error(`使ってはいけない表記: ${banned.length}件`);
  for (const { lang, key, label, value } of banned) {
    console.error(`  - [${lang}] ${key}: ${label}`);
    console.error(`      ${value}`);
  }
}
if (unmarked.length > 0) {
  console.error(`基本技能の名前から印（＊）が落ちている: ${unmarked.length}件`);
  for (const { key, label, value } of unmarked) {
    console.error(`  - ${key}: 〈${label}〉 → 〈＊${label}〉`);
    console.error(`      ${value}`);
  }
}
if (unterminated.length > 0) {
  console.error(`文が続いているのに末尾の「。」が無い: ${unterminated.length}件`);
  for (const [key, value] of unterminated) console.error(`  - ${key}: ${value}`);
}
if (unterminatedNotice.length > 0) {
  console.error(`通知に使うキーが「。」で終わっていない: ${unterminatedNotice.length}件`);
  for (const key of unterminatedNotice) console.error(`  - ${key}: ${ja.get(key)}`);
}

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

const failures =
  missing.length +
  extra.length +
  misordered.length +
  mismatched.length +
  dotted.length +
  bareLeaves.length +
  untranslated.length +
  banned.length +
  unmarked.length +
  unterminated.length +
  unterminatedNotice.length;
if (failures > 0) process.exit(1);
console.log(
  `lang OK: ja.json と en.json が一致（${ja.size}件、並び順とプレースホルダも一致）。` +
    `表記も規約どおり（通知${notificationKeys.size}件を含む）`,
);
