// docs/code-design.md の「層とimportの方向」の表を仕様として読み、module/ の
// importがその方向に従っているかチェックする。従っていなければ exit 1
//
// 表をここへ書き写さないのは、規約とチェッカーの二重管理を作らないため。
// 表の行を書き換えれば検査もそのまま追従する。循環はBiomeの noImportCycles が
// 守っているので、ここでは方向だけを見る
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const DOC = "docs/code-design.md";
const MODULE_DIR = "module";

// 表に無い方向を許す唯一の例外。docs/code-design.md「層とimportの方向」が
// 「現状の例外は1つ」として明記しているもので、経緯は docs/architecture.md の
// 「既知の構造的課題」にある。使われていないエントリが残ったら落とす
const ALLOWLIST = new Set(["module/config/index.ts -> utils"]);

// 層に属さないもの。module/ 直下のファイル（エントリと、どの層から読んでも
// よい constants / settings）と、実行時のimportグラフに乗らないアンビエント宣言
const NON_LAYER_DIRS = new Set(["types"]);

// --- docsの表を読む ---------------------------------------------------------

const section = readFileSync(DOC, "utf-8")
  .split(/^## /m)
  .find((part) => part.startsWith("層とimportの方向"));
if (!section) {
  console.error(`${DOC} に「層とimportの方向」の節が無い`);
  process.exit(1);
}

// 行の形: | `chat/` | `config/` `rules/` `data/` `utils/`。`dice/` `documents/` は型のみ |
// セルを「。」で区切り、「型のみ」を含む区切りの層は import type でだけ許す。
// 「上のすべて」は自層以外のすべて、「なし」は空（層名が出ないので自然に空になる）
const rules = new Map(); // 層名 → { value: Set, typeOnly: Set, all: boolean }
for (const line of section.split("\n")) {
  const cells = line.split("|").map((cell) => cell.trim());
  const layer = cells.length >= 4 ? /^`([a-z-]+)\/`$/.exec(cells[1])?.[1] : undefined;
  if (layer === undefined) continue;
  const rule = { value: new Set(), typeOnly: new Set(), all: false };
  for (const clause of cells[2].split("。")) {
    const targets = [...clause.matchAll(/`([a-z-]+)\/`/g)].map((m) => m[1]);
    if (clause.includes("上のすべて")) rule.all = true;
    else if (clause.includes("型のみ")) for (const t of targets) rule.typeOnly.add(t);
    else for (const t of targets) rule.value.add(t);
  }
  rules.set(layer, rule);
}

// 表とディスクの層が一致しないなら、コードより先に計測器のほうを疑う
const dirs = readdirSync(MODULE_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !NON_LAYER_DIRS.has(entry.name))
  .map((entry) => entry.name);
const unknownDirs = dirs.filter((dir) => !rules.has(dir));
const missingDirs = [...rules.keys()].filter((layer) => !dirs.includes(layer));
if (unknownDirs.length + missingDirs.length > 0) {
  if (unknownDirs.length > 0) console.error(`表に無い層: ${unknownDirs.join(", ")}`);
  if (missingDirs.length > 0)
    console.error(`表にあるが module/ に無い層: ${missingDirs.join(", ")}`);
  console.error(`${DOC} の「層とimportの方向」の表と module/ を揃えること`);
  process.exit(1);
}

// --- importを走査する -------------------------------------------------------

// 行番号を保ったままコメントを消す。ブロックコメントは改行だけ残し、
// 行コメントは行頭から始まるものだけ落とす（文字列中の "//" を巻き込まない）
const stripComments = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ""))
    .replace(/^\s*\/\/.*$/gm, "");

// import / export-from 宣言。中括弧は複数行に渡ってよい
const STATIC_RE =
  /^(?:import|export)\s+(?:type\s+)?(?:\*(?:\s+as\s+[\w$]+)?|\{[^}]*\}|[\w$]+\s*,\s*\{[^}]*\}|[\w$]+)\s+from\s*["']([^"']+)["']/gm;
const SIDE_EFFECT_RE = /^import\s*["']([^"']+)["']/gm;
const DYNAMIC_RE = /(typeof\s+)?\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;

// 宣言全体が型だけか。import type / export type、または名前つきimportの
// 全指定子が type 付き（default importが混ざれば値）
const isTypeOnly = (statement) => {
  if (/^(?:import|export)\s+type\b/.test(statement)) return true;
  const braces = /\{([^}]*)\}/.exec(statement);
  if (!braces || /^(?:import|export)\s+[\w$]/.test(statement)) return false;
  const specifiers = braces[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return specifiers.length > 0 && specifiers.every((s) => s.startsWith("type "));
};

const collectImports = (source) => {
  const stripped = stripComments(source);
  const lineOf = (index) => stripped.slice(0, index).split("\n").length;
  const imports = [];
  for (const m of stripped.matchAll(STATIC_RE)) {
    imports.push({ spec: m[1], typeOnly: isTypeOnly(m[0]), line: lineOf(m.index) });
  }
  for (const m of stripped.matchAll(SIDE_EFFECT_RE)) {
    imports.push({ spec: m[1], typeOnly: false, line: lineOf(m.index) });
  }
  for (const m of stripped.matchAll(DYNAMIC_RE)) {
    imports.push({ spec: m[2], typeOnly: m[1] !== undefined, line: lineOf(m.index) });
  }
  return imports;
};

// 相対importの先が module/<層>/ ならその層名。外部・本体（@client など）と
// 横断ファイル（constants / settings / types）は対象外
const targetLayerOf = (file, spec) => {
  if (!spec.startsWith(".")) return undefined;
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), spec));
  const [root, layer] = resolved.split("/");
  return root === MODULE_DIR && rules.has(layer) ? layer : undefined;
};

const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) walk(entryPath);
    else if (entry.name.endsWith(".ts")) files.push(entryPath);
  }
};
walk(MODULE_DIR);

const violations = [];
const usedAllowlist = new Set();
let checked = 0;
for (const file of files) {
  const [, layer, rest] = file.split(/\//);
  // module/ 直下のファイルは層に属さない（エントリと constants / settings）
  if (rest === undefined || !rules.has(layer)) continue;
  const rule = rules.get(layer);
  for (const { spec, typeOnly, line } of collectImports(readFileSync(file, "utf-8"))) {
    const target = targetLayerOf(file, spec);
    if (target === undefined || target === layer) continue;
    checked += 1;
    const valueAllowed = rule.all || rule.value.has(target);
    if (typeOnly ? valueAllowed || rule.typeOnly.has(target) : valueAllowed) continue;
    const key = `${file} -> ${target}`;
    if (ALLOWLIST.has(key)) {
      usedAllowlist.add(key);
      continue;
    }
    violations.push(
      rule.typeOnly.has(target)
        ? `${file}:${line} ${layer}/ → ${target}/ は型のみ可（import type にする）`
        : `${file}:${line} ${layer}/ → ${target}/ は表に無い方向`,
    );
  }
}

const staleAllowlist = [...ALLOWLIST].filter((key) => !usedAllowlist.has(key));

if (violations.length > 0) {
  console.error(`層の方向に反するimport: ${violations.length}件`);
  for (const entry of violations) console.error(`  - ${entry}`);
  console.error(
    `直すのはimportの側。規約ごと変えるなら ${DOC} の表とこのチェッカーのallowlistを更新する`,
  );
}
if (staleAllowlist.length > 0) {
  console.error(`allowlistにあるが該当するimportが無い（エントリを消すこと）:`);
  for (const entry of staleAllowlist) console.error(`  - ${entry}`);
}
if (violations.length + staleAllowlist.length > 0) process.exit(1);
console.log(`layers OK: ${checked}件の層間importが表に適合（例外 ${usedAllowlist.size}件）`);
