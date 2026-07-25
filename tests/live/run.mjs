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
// 検証を足すときは checks/ にファイルを1つ作って CHECKS に並べる。

import * as activeEffect from "./checks/active-effect.mjs";
import * as armor from "./checks/armor.mjs";
import * as boundary from "./checks/boundary.mjs";
import * as characterSheet from "./checks/character-sheet.mjs";
import * as combat from "./checks/combat.mjs";
import * as consoleCheck from "./checks/console.mjs";
import * as customSkill from "./checks/custom-skill.mjs";
import * as emotionMatch from "./checks/emotion-match.mjs";
import * as emotionPicker from "./checks/emotion-picker.mjs";
import * as howling from "./checks/howling.mjs";
import * as importCheck from "./checks/import.mjs";
import * as npcKai from "./checks/npc-kai.mjs";
import * as registration from "./checks/registration.mjs";
import * as resonanceRequest from "./checks/resonance-request.mjs";
import * as schema from "./checks/schema.mjs";
import * as skillRequest from "./checks/skill-request.mjs";
import * as skillRoll from "./checks/skill-roll.mjs";
import * as weapon from "./checks/weapon.mjs";
import { closeBrowser, ensureChrome, openPage } from "./lib/cdp.mjs";
import { ORIGIN, WORLD } from "./lib/config.mjs";
import { createFixtures, removeFixtures } from "./lib/fixtures.mjs";
import { build, joinAsUser, preflight, startFoundry } from "./lib/foundry.mjs";
import { createRunner, DICE, installPageHelpers, pinDice } from "./lib/harness.mjs";

// 並び順に意味がある。土台（登録・スキーマ）から先に見て、
// 総合（エラーの有無）は全部触ったあとで見る
const CHECKS = [
  registration,
  schema,
  characterSheet,
  skillRoll,
  skillRequest,
  customSkill,
  weapon,
  npcKai,
  emotionPicker,
  emotionMatch,
  resonanceRequest,
  boundary,
  armor,
  howling,
  activeEffect,
  combat,
  importCheck,
  consoleCheck,
];

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
    try {
      const removed = await removeFixtures(page);
      log(`\n検証用データを削除: ${removed.join(", ") || "なし"}`);
    } catch (error) {
      console.error(`検証用データの後始末に失敗した（手で消すこと）: ${error.message}`);
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
