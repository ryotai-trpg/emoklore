// docs のスキーマ表と module/config のテーブルがずれていないかチェックする
// キーに添えた日本語名が lang/ja.json と食い違っていたら exit 1
//
// configのテーブルは型だけをimportしていてFoundryに依存しないので、Node がそのまま
// .ts を読める（erasableSyntaxOnly が型剥がし可能であることを保証している）。
// ビルドもローダも要らない
import { readFileSync } from "node:fs";
import { attackSkills } from "../module/config/attack-skills.ts";
import { baseSkills } from "../module/config/base-skills.ts";
import { characteristics } from "../module/config/characteristics.ts";
import { emotionAttributes } from "../module/config/emotion-attributes.ts";
import { howlingCategories } from "../module/config/howling-categories.ts";
import { resonantEmotions } from "../module/config/resonant-emotions.ts";
import { skillGroups } from "../module/config/skill-groups.ts";
import { skills } from "../module/config/skills.ts";

const ja = JSON.parse(readFileSync("lang/ja.json", "utf-8"));
const localize = (key) => key.split(".").reduce((node, part) => node?.[part], ja);

// requireFullCoverage: 表として全キーを載せることを求めるもの。
// 共鳴感情は47件あり、スキーマの参照ではなくデータの一覧なので、
// 書かれている分の綴りだけ照合して網羅は求めない
const TABLES = [
  { name: "characteristics", table: characteristics, requireFullCoverage: true },
  { name: "skillGroups", table: skillGroups, requireFullCoverage: true },
  { name: "baseSkills", table: baseSkills, requireFullCoverage: true },
  { name: "skills", table: skills, requireFullCoverage: true },
  { name: "attackSkills", table: attackSkills, requireFullCoverage: true },
  { name: "emotionAttributes", table: emotionAttributes, requireFullCoverage: true },
  { name: "howlingCategories", table: howlingCategories, requireFullCoverage: true },
  { name: "resonantEmotions", table: resonantEmotions, requireFullCoverage: false },
];

const DOCS = ["docs/data-model.md", "docs/active-effect.md"];

// 同じキーが複数のテーブルに出る（investigation は基本技能と技能グループの両方、
// fight は基本技能と攻撃技能の両方）。どのテーブルとして書かれていてもよいので、
// キーに対して許容ラベルの集合を持つ
// preLocalize の対象になる表は `label`（i18nInit で翻訳済みの文字列に差し替わる）、
// 対象外の表は `labelKey`（i18nキーのまま）を持つ。ここは Foundry を起動しないので、
// どちらもi18nキーの文字列として読める
const labelsByKey = new Map();
const missingLabels = [];
for (const { table, name } of TABLES) {
  for (const [key, config] of Object.entries(table)) {
    const label = localize(config.label ?? config.labelKey);
    if (label === undefined) {
      missingLabels.push(`${name}.${key} → ${config.label}`);
      continue;
    }
    if (!labelsByKey.has(key)) labelsByKey.set(key, new Set());
    labelsByKey.get(key).add(label);
  }
}

// 「キーと日本語名を並べている箇所」だけを照合する。表のセル（`|` 区切り）か、
// 箇条書きの `名前：`key`` の形で、**区画まるごとがキー1つ**になっているものを拾う。
// 既定値や本文でキー名に触れているだけの行（「既定 `fight`」など）は対象外
const KEY_CELL = /^`([A-Za-z][A-Za-z0-9]*)`$/;
const mismatches = [];
const documented = new Set();

for (const path of DOCS) {
  const lines = readFileSync(path, "utf-8").split("\n");
  lines.forEach((line, index) => {
    // 表ではキーは必ず先頭の列。それ以外の列に出るキー名は既定値などの参照なので見ない
    const cells = line.includes("|")
      ? [line.split("|").find((cell) => cell.trim() !== "") ?? ""]
      : [line];
    for (const segment of cells.flatMap((cell) => cell.split(/[：:]/))) {
      const matched = KEY_CELL.exec(segment.trim());
      if (!matched) continue;
      const key = matched[1];
      const labels = labelsByKey.get(key);
      if (!labels) continue;
      documented.add(key);
      if ([...labels].some((label) => line.includes(label))) continue;
      mismatches.push(
        `${path}:${index + 1} \`${key}\` の日本語名が合わない（正: ${[...labels].join(" / ")}）\n    ${line.trim()}`,
      );
    }
  });
}

const uncovered = [];
for (const { name, table, requireFullCoverage } of TABLES) {
  if (!requireFullCoverage) continue;
  const missing = Object.keys(table).filter((key) => !documented.has(key));
  if (missing.length > 0) uncovered.push(`${name}: ${missing.join(", ")}`);
}

if (missingLabels.length > 0) {
  console.error(`lang/ja.json に無いラベル: ${missingLabels.length}件`);
  for (const entry of missingLabels) console.error(`  - ${entry}`);
}
if (mismatches.length > 0) {
  console.error(`ドキュメントとconfigで日本語名が食い違う: ${mismatches.length}件`);
  for (const entry of mismatches) console.error(`  - ${entry}`);
}
if (uncovered.length > 0) {
  console.error(`ドキュメントに載っていないキー:`);
  for (const entry of uncovered) console.error(`  - ${entry}`);
}

if (missingLabels.length + mismatches.length + uncovered.length > 0) process.exit(1);
console.log(`schema doc OK: ${documented.size}件のキーが config と一致`);
