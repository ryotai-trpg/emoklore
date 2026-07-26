// lang/ja.json のキーと、それを参照する側（templates / module / tests / system.json）の
// 突き合わせをチェックする。
//
// 1. 参照されているのに lang/ja.json に無いキー（画面に生キーが出る）
// 2. lang/ja.json にあるのにどこからも参照されないキー（消し忘れ）
//
// check:lang は ja/en の突き合わせしか見ず、check:templates は i18n を一切見ない。
// テンプレート側の綴り間違いはこれまで verify:live の描画でしか捕まらなかった。
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const LANG = "lang/ja.json";

// 未定義チェックの対象にする名前空間。
//
// EMOKLORE と SETTINGS.EMOKLORE はこのシステムだけの名前空間なので、ここに無いキーを
// 引いていたら綴り間違いだと断定できる。TYPES / USER / DOCUMENT などは本体と共有していて、
// 本体側で解決するキーを引いている可能性があるため、未定義の判定には使わない。
const OWNED_ROOTS = ["EMOKLORE", "SETTINGS"];

// 参照が無くても正しいキー。本体が読むので、こちらのソースには文字列が出てこない。
const READ_BY_FOUNDRY = [
  { pattern: /^TYPES\./, why: "本体が CONFIG.*.typeLabels に入れる" },
  { pattern: /^USER\./, why: "本体の文字列の上書き" },
  { pattern: /\.FIELDS\./, why: "localizeSchema がスキーマのラベルに使う" },
];

// キーの1区画。lang/ja.json の全キーがこの形をしている
const SEGMENT = "[A-Za-z0-9_]+";
const KEY_SHAPE = new RegExp(`^(?:${OWNED_ROOTS.join("|")})(?:\\.${SEGMENT})+$`);

// 引用符・バッククォートで囲まれた、こちらの名前空間で始まる文字列
const QUOTED = new RegExp(`["'\`](?:${OWNED_ROOTS.join("|")})\\.[^"'\`\\n]*`, "g");

const listFiles = (dir, ...exts) =>
  readdirSync(dir, { recursive: true })
    .map(String)
    .filter((file) => exts.some((ext) => file.endsWith(ext)))
    .map((file) => join(dir, file));

const flatten = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value !== null && typeof value === "object" ? flatten(value, path) : [path];
  });

/** 葉ではない節（＝名前空間）のパス */
const nodePaths = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([key, value]) => {
    if (value === null || typeof value !== "object") return [];
    const path = prefix ? `${prefix}.${key}` : key;
    return [path, ...nodePaths(value, path)];
  });

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * ソースからキーらしき文字列を拾う。
 *
 * 静的なものはそのまま、テンプレートリテラルの `` `EMOKLORE.Result.${name}` `` は
 * 埋め込み部分を1区画のワイルドカードにしたパターンとして扱う。動的キーを手書きの
 * allowlistで除外せずに済み、書き換えれば自動で追従する。
 *
 * 区画を [A-Za-z0-9_]+ に限っているので、コメントの中の `SETTINGS.EMOKLORE.<キー>` の
 * ような説明用の綴りは拾わない。コメントを剥がす必要がないぶん、文字列中のURLを
 * 誤って切り落とす心配もない。
 */
function collectReferences(source) {
  const exact = new Set();
  const patterns = new Map();

  for (const [match] of source.matchAll(QUOTED)) {
    const text = match.slice(1);
    if (!text.includes("${")) {
      if (KEY_SHAPE.test(text)) exact.add(text);
      continue;
    }
    // 埋め込みを跨いで静的な部分がすべて残るようにパターンを組む
    const parts = text.split(/\$\{[^}]*\}/);
    if (!parts.every((part) => /^[A-Za-z0-9_.]*$/.test(part))) continue;
    patterns.set(text, new RegExp(`^${parts.map(escapeRegExp).join(SEGMENT)}$`));
  }
  return { exact, patterns };
}

const lang = JSON.parse(readFileSync(LANG, "utf-8"));
const keys = flatten(lang);
const defined = new Set(keys);
const namespaces = new Set(nodePaths(lang));

// tests/ は見ない。CONFIG.EMOKLORE.* のプロパティ参照しか無く、i18nキーの文字列は
// JSDocの例（"EMOKLORE.Foo.bar"）だけで、それを拾うと嘘の未定義になる
const sources = [...listFiles("templates", ".hbs"), ...listFiles("module", ".ts"), "system.json"];

const referenced = new Set();
const referencedPatterns = [];
const referencedNamespaces = [];
const undefinedRefs = [];

for (const file of sources) {
  const { exact, patterns } = collectReferences(readFileSync(file, "utf-8"));
  for (const key of exact) {
    // LOCALIZATION_PREFIXES や TABS の labelPrefix は葉ではなく名前空間を指す。
    // 配下の何を読むかを決めるのは本体なので、静的には追えない。
    // 名前空間が参照されていたら、その配下はまとめて「使われている」とみなす
    if (namespaces.has(key)) {
      referencedNamespaces.push(key);
      continue;
    }
    referenced.add(key);
    if (!defined.has(key)) undefinedRefs.push(`${file}: ${key}`);
  }
  for (const [text, pattern] of patterns) {
    referencedPatterns.push(pattern);
    // 動的キーは1つに定まらないが、1件も当たらないなら綴りが違う。
    // `EMOKLORE.Result.${name}` の result を打ち間違えるとここで落ちる
    if (!keys.some((key) => pattern.test(key))) {
      undefinedRefs.push(`${file}: ${text}（動的キー、該当するキーが無い）`);
    }
  }
}

// lang の値そのものがキーになっている場合、それも参照として数える。
// FIELDS のラベルに `EMOKLORE.Config.characteristics.<能力値>` を置くと、
// localizeSchema の `this.label ||= _loc(...)` が1回解決して能力値名になる。
// 能力値名を2箇所に書かずに済む正しい書き方なので、参照として扱う
const collectValueReferences = (node) => {
  if (typeof node === "string") return KEY_SHAPE.test(node) ? [node] : [];
  if (node === null || typeof node !== "object") return [];
  return Object.values(node).flatMap(collectValueReferences);
};

for (const key of collectValueReferences(lang)) referenced.add(key);

const unused = keys.filter((key) => {
  if (referenced.has(key)) return false;
  if (referencedPatterns.some((pattern) => pattern.test(key))) return false;
  if (referencedNamespaces.some((namespace) => key.startsWith(`${namespace}.`))) return false;
  return !READ_BY_FOUNDRY.some(({ pattern }) => pattern.test(key));
});

if (undefinedRefs.length > 0) {
  console.error(`${LANG} に無いキーを参照している: ${undefinedRefs.length}件`);
  for (const entry of undefinedRefs) console.error(`  - ${entry}`);
}
if (unused.length > 0) {
  console.error(`どこからも参照されていないキー: ${unused.length}件`);
  for (const key of unused) console.error(`  - ${key}`);
}

if (undefinedRefs.length + unused.length > 0) process.exit(1);
console.log(`i18n OK: ${referenced.size}件のキー参照が解決、未使用キーなし`);
