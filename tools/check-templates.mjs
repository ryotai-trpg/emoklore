// templates/ 配下の Handlebars テンプレートを検査する。
//
// 1. precompile して構文エラーを検出する（ヘルパーの解決はしない）
// 2. HTMLタグの対応を見る
// 3. {{> "..."}} が指すpartialが実在するか見る
// 4. どこからも参照されていないテンプレートを見つける
// 5. ハッシュ引数つきで呼ばれるpartialが先頭コメントに @param を持つか見る
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Handlebars from "handlebars";

const SYSTEM_PREFIX = "systems/emoklore/";

// 閉じタグを持たない要素
const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

const listFiles = (dir, ext) =>
  readdirSync(dir, { recursive: true })
    .map(String)
    .filter((file) => file.endsWith(ext))
    .map((file) => join(dir, file));

/**
 * HTMLタグの対応を見る。
 *
 * Handlebarsの式をすべて落としてから素のHTMLとして突き合わせるので、
 * {{#if}} の分岐ごとにタグの開閉が完結していることを前提にしている。
 * 片方の分岐でだけタグを開くような書き方をすると誤検知する。
 */
const findTagImbalance = (source) => {
  const html = source.replace(/\{\{[\s\S]*?\}\}/g, "");
  const stack = [];
  const tagPattern = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)[^>]*?(\/?)>/g;

  let match = tagPattern.exec(html);
  while (match !== null) {
    const [, closing, rawName, selfClosing] = match;
    const tag = rawName.toLowerCase();

    if (!VOID_TAGS.has(tag) && selfClosing !== "/") {
      if (closing) {
        const open = stack.pop();
        if (open === undefined) return `</${tag}> に対応する開始タグがない`;
        if (open !== tag) return `<${open}> が </${tag}> で閉じられている`;
      } else {
        stack.push(tag);
      }
    }
    match = tagPattern.exec(html);
  }

  return stack.length > 0 ? `<${stack[stack.length - 1]}> が閉じられていない` : null;
};

/** {{> "systems/emoklore/templates/..."}} が指す先をリポジトリ相対のパスで返す */
const findPartialRefs = (source) =>
  [...source.matchAll(/\{\{>\s*"([^"]+)"/g)]
    .map(([, path]) => path)
    .filter((path) => path.startsWith(SYSTEM_PREFIX))
    .map((path) => path.slice(SYSTEM_PREFIX.length));

const templates = listFiles("templates", ".hbs");
const errors = [];

for (const file of templates) {
  const source = readFileSync(file, "utf-8");

  try {
    Handlebars.precompile(source);
  } catch (error) {
    errors.push(`${file}: ${error.message.split("\n")[0]}`);
    // 構文が壊れているならタグの対応を見ても意味がない
    continue;
  }

  const imbalance = findTagImbalance(source);
  if (imbalance) errors.push(`${file}: ${imbalance}`);

  for (const ref of findPartialRefs(source)) {
    if (!existsSync(ref)) errors.push(`${file}: partialが実在しない -> ${ref}`);
  }
}

// PARTS やチャットカードからの参照はTS側にあるので、そちらも見る
const referenced = new Set();
for (const file of listFiles("module", ".ts")) {
  const source = readFileSync(file, "utf-8");
  for (const [, path] of source.matchAll(/["'`](templates\/[\w/-]+\.hbs)["'`]/g)) {
    referenced.add(path);
  }
}
for (const file of templates) {
  for (const ref of findPartialRefs(readFileSync(file, "utf-8"))) referenced.add(ref);
}

const orphans = templates.filter((file) => !referenced.has(file));
for (const orphan of orphans) {
  errors.push(`${orphan}: どこからも参照されていない`);
}

// 引数を取る再利用部品は先頭のコメントに @param を書く（docs/ui-design.md）。
// 引数なしで呼ぶpartialは現在のコンテキストがそのまま渡るだけなので対象にしない
const withHashArgs = new Set();
for (const file of templates) {
  const source = readFileSync(file, "utf-8");
  for (const [, path, args] of source.matchAll(/\{\{>\s*"([^"]+)"([\s\S]*?)\}\}/g)) {
    if (!path.startsWith(SYSTEM_PREFIX)) continue;
    if (/[A-Za-z_]\w*\s*=/.test(args)) withHashArgs.add(path.slice(SYSTEM_PREFIX.length));
  }
}
for (const partial of [...withHashArgs].sort()) {
  if (!existsSync(partial)) continue;
  // 先頭のコメントブロックだけを見る。本文中の @param は目次にならない
  const head = /^\s*\{\{!--([\s\S]*?)--\}\}|^\s*\{\{!([\s\S]*?)\}\}/.exec(
    readFileSync(partial, "utf-8"),
  );
  const doc = head ? (head[1] ?? head[2] ?? "") : "";
  if (!doc.includes("@param")) {
    errors.push(`${partial}: ハッシュ引数で呼ばれるのに先頭コメントに @param が無い`);
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(`NG ${error}`);
  console.error(`\ntemplates NG: ${errors.length}件`);
  process.exit(1);
}

console.log(
  `templates OK: ${templates.length}ファイル（構文・タグ対応・参照、` +
    `引数つきpartial ${withHashArgs.size}件の @param）`,
);
