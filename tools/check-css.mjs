// css/ の .em-* とテンプレート・コード・実機検証の em-* を突き合わせる。
// 規約は docs/ui-design.md「クラスを置く粒度」:
//   - どこからも参照されないCSS規則（孤児）は消し忘れなので落とす
//   - CSSの規則もJSのフックも無いクラスは置かない。フックは module/ だけでなく
//     tests/live/ のセレクタも含む（静的チェックが通って verify:live だけが落ちる形を防ぐ）
//   - 例外は「見分けのつかない兄弟を区別している」クラスだけで、allowlist に置く
//
// 動的な修飾子（`em-meter--{{color}}` など）は check:i18n と同じく静的な部分を
// 前方一致のパターンとして扱う。書き換えれば追従し、当たらなくなれば孤児として落ちる
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

// 規則もフックも持たないことが意図的なクラス。グリッドに並ぶ見分けのつかない
// 兄弟を区別している（docs/ui-design.md「クラスを置く粒度」の例外）。
// 規則やフックが付いたら、ここから消さないと落ちる
const HOOKLESS_ALLOWED = new Set([
  "em-effect-change__target",
  "em-effect-change__type",
  "em-effect-change__value",
  "em-effect-change__phase",
  "em-effect-change__priority",
  "em-skill-row__spec",
]);

const walk = (dir, exts, files = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) walk(entryPath, exts, files);
    else if (exts.some((ext) => entry.name.endsWith(ext))) files.push(entryPath);
  }
  return files;
};

// コメントの中の言及は定義でも使用でもない。クラス名を文章で説明しているだけの
// 箇所を拾うと、消えた規則が「使われている」ことになってしまう
const stripCss = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "");
const stripHbs = (src) =>
  src
    .replace(/\{\{!--[\s\S]*?--\}\}/g, "")
    .replace(/\{\{![\s\S]*?\}\}/g, "")
    .replace(/<!--[\s\S]*?-->/g, "");
const stripTs = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// 左に単語が続く形（data-item-type の中の em-type など）を拾わない
const TOKEN = /(?<![a-z0-9_-])em-[a-z0-9_-]+/g;

// --- CSS側: 定義されているクラス --------------------------------------------

const defined = new Map(); // クラス → Set<ファイル>
for (const file of walk("css", [".css"])) {
  for (const m of stripCss(readFileSync(file, "utf-8")).matchAll(/\.(em-[a-z0-9_-]+)/g)) {
    if (!defined.has(m[1])) defined.set(m[1], new Set());
    defined.get(m[1]).add(file);
  }
}

// --- 使用側 ------------------------------------------------------------------

const exact = new Set(); // 完全なクラス名
const prefixes = new Set(); // 「em-meter--」のように {{...}} の手前で切れた前方一致
const templateTokens = new Map(); // 掴み手の検査用: テンプレートに書かれた完全な名前 → ファイル
const moduleTokens = new Set();
const testTokens = new Set();

const collectTokens = (text, onToken) => {
  for (const m of text.matchAll(TOKEN)) {
    if (/[-_]$/.test(m[0])) prefixes.add(m[0]);
    else {
      exact.add(m[0]);
      onToken?.(m[0]);
    }
  }
};

for (const file of walk("templates", [".hbs"])) {
  const src = stripHbs(readFileSync(file, "utf-8"));
  collectTokens(src, (token) => {
    if (!templateTokens.has(token)) templateTokens.set(token, file);
  });
  // {{...}} を取り除いて連結した形。`em-x{{#if m}}--mod{{/if}}` から em-x--mod を復元する
  collectTokens(src.replace(/\{\{[^}]*\}\}/g, ""));
}
for (const file of walk("module", [".ts"])) {
  collectTokens(stripTs(readFileSync(file, "utf-8")), (token) => moduleTokens.add(token));
}
for (const file of walk("tests", [".mjs"])) {
  collectTokens(stripTs(readFileSync(file, "utf-8")), (token) => testTokens.add(token));
}

// --- 突き合わせ --------------------------------------------------------------

const isUsed = (name) => exact.has(name) || [...prefixes].some((p) => name.startsWith(p));
const orphans = [...defined.keys()].filter((name) => !isUsed(name));

const hookless = [...templateTokens.keys()].filter(
  (name) =>
    !defined.has(name) &&
    !moduleTokens.has(name) &&
    !testTokens.has(name) &&
    !HOOKLESS_ALLOWED.has(name),
);
const staleAllowlist = [...HOOKLESS_ALLOWED].filter(
  (name) =>
    !templateTokens.has(name) ||
    defined.has(name) ||
    moduleTokens.has(name) ||
    testTokens.has(name),
);

if (orphans.length > 0) {
  console.error(`どこからも参照されないCSS規則: ${orphans.length}件`);
  for (const name of orphans) console.error(`  - .${name}  (${[...defined.get(name)].join(", ")})`);
  console.error("規則を消すか、クラスを消したのが誤りならテンプレート側を戻す");
}
if (hookless.length > 0) {
  console.error(`CSSの規則もフックも無いクラス: ${hookless.length}件`);
  for (const name of hookless) console.error(`  - ${name}  (${templateTokens.get(name)})`);
  console.error(
    "規則もフックも無いクラスは置かない（docs/ui-design.md「クラスを置く粒度」）。兄弟の区別が要るならこのチェッカーのallowlistに理由ごと足す",
  );
}
if (staleAllowlist.length > 0) {
  console.error(
    `allowlistにあるが「規則もフックも無いテンプレートのクラス」ではない（エントリを消すこと）:`,
  );
  for (const name of staleAllowlist) console.error(`  - ${name}`);
}
if (orphans.length + hookless.length + staleAllowlist.length > 0) process.exit(1);
console.log(
  `css OK: 規則${defined.size}クラスすべてに参照があり、テンプレートの${templateTokens.size}クラスに掴み手がある（例外 ${HOOKLESS_ALLOWED.size}件）`,
);
