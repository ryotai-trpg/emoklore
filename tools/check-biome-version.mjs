// Biomeのバージョンが3箇所で揃っているかチェックする
// （package.json / biome.json の $schema / ci.yml の setup-biome）
//
// プラグイン（tools/*.grit）を使う都合でバージョンを固定しているため、揃っていないと
// CIとローカルで違うBiomeが走る。追従の手順は docs/contributing.md に書いてあるが、
// Dependabotの更新で2回続けて漏れたので機械で見る
import { readFileSync } from "node:fs";

const PACKAGE_JSON = "package.json";
const BIOME_JSON = "biome.json";
const CI_YML = ".github/workflows/ci.yml";

/** @type {{ where: string, version: string }[]} */
const found = [];
const problems = [];

// 1. package.json の devDependencies
const declared = JSON.parse(readFileSync(PACKAGE_JSON, "utf-8")).devDependencies?.[
  "@biomejs/biome"
];
if (declared === undefined) {
  problems.push(`${PACKAGE_JSON}: devDependencies に @biomejs/biome が無い`);
} else if (!/^\d+\.\d+\.\d+$/.test(declared)) {
  // ^ や ~ が付くと他の2箇所と一致していてもローカルだけ別のBiomeが入りうるので、
  // 完全固定であること自体を検査する
  problems.push(
    `${PACKAGE_JSON}: @biomejs/biome は範囲指定ではなく完全固定にする（現在: ${declared}）`,
  );
} else {
  found.push({ where: `${PACKAGE_JSON} の @biomejs/biome`, version: declared });
}

// 2. biome.json の $schema。バージョンはURLの一部なので抜き出す
const schema = JSON.parse(readFileSync(BIOME_JSON, "utf-8")).$schema;
const schemaVersion = /schemas\/(\d+\.\d+\.\d+)\//.exec(schema ?? "")?.[1];
if (schemaVersion === undefined) {
  problems.push(`${BIOME_JSON}: $schema からバージョンを読めない（現在: ${schema}）`);
} else {
  found.push({ where: `${BIOME_JSON} の $schema`, version: schemaVersion });
}

// 3. ci.yml の setup-biome。YAMLパーサを足さずに済ませたいので、`uses:` の行を見つけて
// 次のステップ（`- ` で始まる行）に入るまでの `version:` を拾う
const lines = readFileSync(CI_YML, "utf-8").split("\n");
const stepIndex = lines.findIndex((line) => /^\s*-\s*uses:\s*biomejs\/setup-biome@/.test(line));
if (stepIndex === -1) {
  problems.push(`${CI_YML}: biomejs/setup-biome のステップが見つからない`);
} else {
  let ciVersion;
  for (const line of lines.slice(stepIndex + 1)) {
    if (/^\s*-\s/.test(line)) break;
    const matched = /^\s*version:\s*["']?(\S+?)["']?\s*$/.exec(line);
    if (matched) {
      ciVersion = matched[1];
      break;
    }
  }
  if (ciVersion === undefined) problems.push(`${CI_YML}: setup-biome に version の指定が無い`);
  else found.push({ where: `${CI_YML} の setup-biome`, version: ciVersion });
}

const versions = new Set(found.map(({ version }) => version));
if (versions.size > 1) {
  problems.push("3箇所のバージョンが揃っていない");
  for (const { where, version } of found) problems.push(`  ${version}  ← ${where}`);
}

if (problems.length > 0) {
  console.error("Biomeのバージョンが同期していない（追従の手順は docs/contributing.md）:");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(`biome version OK: 3箇所とも ${[...versions][0]}`);
