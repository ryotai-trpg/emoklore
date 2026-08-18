// Biomeのバージョンが package.json で完全固定されているかチェックする
//
// プラグイン（tools/*.grit）の挙動はパッチ版でも変わりうるので、上がる時期は
// Dependabotのレビューで明示的に決めたい。範囲指定に戻すとそれが効かなくなる。
//
// かつてはバージョンが3箇所（package.json / biome.json の $schema / ci.yml の
// setup-biome）に散っており、Dependabotが package.json だけを上げるたびに落ちていた。
// 現在は biome.json が node_modules のスキーマを、CIが lockfile のBiomeを見るので、
// 追従すべき場所はここ1つしかない
import { readFileSync } from "node:fs";

const PACKAGE_JSON = "package.json";

const declared = JSON.parse(readFileSync(PACKAGE_JSON, "utf-8")).devDependencies?.[
  "@biomejs/biome"
];

if (declared === undefined) {
  console.error(`${PACKAGE_JSON}: devDependencies に @biomejs/biome が無い`);
  process.exit(1);
}
if (!/^\d+\.\d+\.\d+$/.test(declared)) {
  console.error(
    `${PACKAGE_JSON}: @biomejs/biome は範囲指定ではなく完全固定にする（現在: ${declared}）`,
  );
  process.exit(1);
}

console.log(`biome version OK: ${declared} で固定されている`);
