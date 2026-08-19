// FoundryVTTを実際に起動し、ヘッドレスChromeでシステムを動かして検証する。
//
// 型チェックとvitestでは捕まらないものを見る。スキーマがCONFIGと食い違っていないか、
// シートが描けるか、ロールが飛ぶか、チャットカードのボタンが順に進むか。
// どれも「起動して触ってみる」以外に確かめようがない。
//
//   npm run verify:live
//
// **CIでは回さない。** FoundryVTT本体（要ライセンス）とChromeがローカルに要るため。
// 設定は lib/config.mjs、規約は docs/testing.md を参照。
//
// 検証を足すときは checks/ にファイルを1つ作って CHECK_FILES に並べる。
// 並べ忘れたファイルは黙って回らない事故になるので、着手前に突き合わせて落とす。

import { readdirSync } from "node:fs";
import { closeBrowser, ensureChrome, openPage } from "./lib/cdp.mjs";
import { ORIGIN, WORLD } from "./lib/config.mjs";
import { createFixtures, removeFixtures } from "./lib/fixtures.mjs";
import { build, joinAsUser, preflight, startFoundry } from "./lib/foundry.mjs";
import { createRunner, DICE, installPageHelpers, pinDice } from "./lib/harness.mjs";

// 並び順に意味がある。土台（登録・スキーマ）から先に見て、
// 総合（エラーの有無）は全部触ったあとで見る
const CHECK_FILES = [
  "registration.mjs",
  "schema.mjs",
  "character-sheet.mjs",
  "skill-roll.mjs",
  "skill-request.mjs",
  "custom-skill.mjs",
  "weapon.mjs",
  "npc-kai.mjs",
  "emotion-picker.mjs",
  "emotion-match.mjs",
  "resonance-request.mjs",
  "boundary.mjs",
  "armor.mjs",
  "howling.mjs",
  "active-effect.mjs",
  "skill-mod-display.mjs",
  "combat.mjs",
  "import.mjs",
  "automation.mjs",
  "console.mjs",
];

const present = readdirSync(new URL("./checks/", import.meta.url))
  .map(String)
  .filter((file) => file.endsWith(".mjs"));
const unregistered = present.filter((file) => !CHECK_FILES.includes(file));
const notFound = CHECK_FILES.filter((file) => !present.includes(file));
if (unregistered.length + notFound.length > 0) {
  if (unregistered.length > 0)
    console.error(
      `checks/ にあるのに CHECK_FILES に並んでいない（回らない）: ${unregistered.join(", ")}`,
    );
  if (notFound.length > 0)
    console.error(`CHECK_FILES にあるのに checks/ に無い: ${notFound.join(", ")}`);
  process.exit(1);
}

const CHECKS = await Promise.all(CHECK_FILES.map((file) => import(`./checks/${file}`)));

const log = (msg) => console.log(msg);

preflight();

if (process.env.SKIP_BUILD !== "1") {
  log("ビルド中…");
  build();
}

log(`Foundryを起動中… ${ORIGIN}（world=${WORLD}）`);
const foundryProc = await startFoundry();

const { check, results } = createRunner({ log });
let page;

try {
  await ensureChrome();
  page = await openPage();

  const who = await joinAsUser(page);
  log(`${who} でログインした`);

  await installPageHelpers(page);
  await pinDice(page, DICE.alwaysHit);

  const fixtures = await createFixtures(page);
  log(`検証用データを作成: ${fixtures.join(", ")}`);

  for (const group of CHECKS) {
    log(`\n${group.title}`);
    await group.run({ page, check });
  }
} catch (error) {
  // 途中で落ちた場合、通ったぶんだけ報告したうえで失敗として終わる。
  // 「チェックが1件も走らなかった」を成功と見分けられなくしない
  results.push({ name: "検証の実行", ok: false, error: error.message });
  console.error(`\n検証が中断した: ${error.message}`);
} finally {
  if (page) {
    // ゲームに入る前に落ちた場合、検証データはまだ1件も作られていない。removeFixtures は
    // game を読むので必ず失敗するが、消すものが無いので「手で消すこと」は誤報になる。
    // 入れたかどうかで分ける
    const joined = await page.eval(() => globalThis.game?.ready === true).catch(() => false);
    if (!joined) {
      log("\nゲームに入れていないので検証データは作られていない（後始末なし）");
    } else {
      try {
        const removed = await removeFixtures(page);
        log(`\n検証用データを削除: ${removed.join(", ") || "なし"}`);
      } catch (error) {
        console.error(`検証用データの後始末に失敗した（手で消すこと）: ${error.message}`);
      }
    }
    page.close();
  }
  await closeBrowser();
  foundryProc.kill();
}

const failed = results.filter((r) => !r.ok);
const passed = results.length - failed.length;

log(`\n${"─".repeat(60)}`);
if (results.length === 0) {
  console.error("チェックが1件も実行されなかった");
  process.exit(1);
}
if (failed.length > 0) {
  console.error(`実機検証 NG: ${passed}/${results.length} 通過`);
  for (const f of failed) console.error(`  - ${f.name}: ${f.error}`);
  process.exit(1);
}
log(`実機検証 OK: ${passed}件すべて通過`);
