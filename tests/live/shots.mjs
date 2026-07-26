// 実機のシートとチャットカードをPNGで採取する。
//
//   npm run shots:live -- --out before
//
// **`verify:live` とは別の口。** あちらは合否を持つ検証で、こちらは判断のための道具。
// 見た目の良し悪しは機械で判定しないので、ここがするのは「決めた条件で撮って、
// 撮れなかったら落ちる」ところまでになる。
//
// 環境（本体・dataPath・ワールド）は `verify:live` と共有する。設定は `lib/config.mjs`、
// 位置づけは `docs/testing.md` を参照。**CIでは回さない。**
//
// フラグ:
//   --out <名前>    出力先を shots/<名前>/ にする（既定 current）。前後比較に使う
//   --probe         シートの min-width を打ち消して、下限より狭い姿も撮る
//   --matrix full   幅の変種もライト／ダークの両方で撮る（既定はライトのみ）

import { closeBrowser, ensureChrome, openPage } from "./lib/cdp.mjs";
import { ORIGIN, WORLD } from "./lib/config.mjs";
import { build, joinAsUser, preflight, startFoundry } from "./lib/foundry.mjs";
import { DICE, installPageHelpers, pinDice } from "./lib/harness.mjs";
import {
  createShotFixtures,
  markShotMessages,
  messageMarker,
  SHOT_NAMES,
  sweepShotFixtures,
} from "./lib/shot-fixtures.mjs";
import { createCardScenes } from "./lib/shot-scenes.mjs";
import {
  captureCard,
  captureSheet,
  closeSheet,
  installShotHelpers,
  openChat,
  openSheet,
  setTheme,
} from "./lib/shots.mjs";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? fallback : (args[at + 1] ?? fallback);
};
const has = (name) => args.includes(`--${name}`);

const OUT = `shots/${flag("out", "current")}`;
const PROBE = has("probe");
const FULL_MATRIX = flag("matrix", "") === "full";

const THEMES = ["light", "dark"];

/**
 * 表示領域。ウィンドウの枠のぶんだけ既定（1440×900のウィンドウ）は縦が足りず、
 * チャット欄に収まらないカードが出る。撮る側で明示的に決める。
 */
const VIEWPORT = { width: 1440, height: 1600 };

/** 共鳴者シートの既定寸法（`applications/character-sheet.ts` の DEFAULT_OPTIONS） */
const CHARACTER_SIZE = { width: 760, height: 710 };

/** 幅の変種。580 は現在の min-width、480 は下限を打ち消したときだけ撮れる */
const WIDTHS = [580, 1000, ...(PROBE ? [{ width: 480, probe: true }] : [])].map((w) =>
  typeof w === "number" ? { width: w } : w,
);

const CHARACTER = { actor: SHOT_NAMES.character };
const TABS = ["skills", "biography", "items", "effects"];
const MODES = ["play", "edit"];

/** 既定幅で撮る対象。共鳴者以外はタブを持たないので寸法もそのまま */
const OTHER_SHEETS = [
  { name: "npc", spec: { actor: SHOT_NAMES.npc } },
  { name: "kai", spec: { actor: SHOT_NAMES.kai } },
  { name: "item-weapon", spec: { actor: CHARACTER.actor, item: SHOT_NAMES.weapon } },
  { name: "item-armor", spec: { actor: CHARACTER.actor, item: SHOT_NAMES.armor } },
  { name: "item-skill", spec: { actor: CHARACTER.actor, item: SHOT_NAMES.customSkill } },
  { name: "item-howling", spec: { actor: CHARACTER.actor, item: SHOT_NAMES.howling } },
];

const log = (msg) => console.log(msg);

let shots = 0;

/** 1枚撮って数える。撮れなかったら `capture` 側が投げる */
const take = async (theme, name, capture) => {
  const size = await capture(`${OUT}/${theme}/${name}.png`);
  shots += 1;
  log(`  ${name}  ${size.width}×${size.height}`);
};

preflight();

if (process.env.SKIP_BUILD !== "1") {
  log("ビルド中…");
  build();
}

log(`Foundryを起動中… ${ORIGIN}（world=${WORLD}）`);
const foundryProc = await startFoundry();

let page;
let failure;

try {
  await ensureChrome();
  page = await openPage();

  const who = await joinAsUser(page);
  log(`${who} でログインした`);

  await page.viewport(VIEWPORT);
  await installPageHelpers(page);
  await installShotHelpers(page);
  // 出目を固定する。振るたびに成功数が変わると、前後で比べられる絵にならない
  await pinDice(page, DICE.alwaysHit);

  const chat = await openChat(page);
  log(`チャット欄を開いた（幅${Math.round(chat.width)}px）`);

  const swept = await sweepShotFixtures(page);
  if (swept.length > 0) log(`前回の残骸を削除: ${swept.join(", ")}`);

  const made = await createShotFixtures(page);
  log(`見本データを作成: ${made.join(", ")}`);

  log("チャットカードを作成中…");
  const marker = await messageMarker(page);
  const cards = await createCardScenes(page);
  // 作り終えた直後に印を付ける。付ける前に落ちたぶんはチャット欄に残る
  const marked = await markShotMessages(page, marker);
  log(
    `カード${Object.keys(cards).length}枚（メッセージ${marked}件）: ${Object.keys(cards).join(", ")}`,
  );

  for (const theme of THEMES) {
    await setTheme(page, theme);
    log(`\n── ${theme} ──`);

    // 共鳴者は既定幅で全タブ×両モード。ここがいちばん判断に使う
    await openSheet(page, CHARACTER);
    for (const mode of MODES) {
      for (const tab of TABS) {
        await take(theme, `character-${tab}-${mode}-${CHARACTER_SIZE.width}`, (path) =>
          captureSheet(page, { spec: CHARACTER, path, mode, tab, ...CHARACTER_SIZE }),
        );
      }
    }

    // 幅の変種は技能タブと経歴タブだけ。幅は寸法の判断、テーマは色の判断で直交しており、
    // 全組み合わせを撮っても読むものが増えない
    if (theme === "light" || FULL_MATRIX) {
      for (const { width, probe } of WIDTHS) {
        for (const tab of ["skills", "biography"]) {
          await take(theme, `character-${tab}-play-${width}${probe ? "-probe" : ""}`, (path) =>
            captureSheet(page, {
              spec: CHARACTER,
              path,
              mode: "play",
              tab,
              width,
              height: CHARACTER_SIZE.height,
              probe,
            }),
          );
        }
      }
    } else {
      log(
        `  （幅の変種 ${WIDTHS.map((w) => w.width).join("/")} は light のみ。--matrix full で両方）`,
      );
    }
    await closeSheet(page, CHARACTER);

    for (const { name, spec } of OTHER_SHEETS) {
      await openSheet(page, spec);
      for (const mode of MODES) {
        await take(theme, `${name}-${mode}`, (path) => captureSheet(page, { spec, path, mode }));
      }
      await closeSheet(page, spec);
    }

    for (const [name, messageId] of Object.entries(cards)) {
      await take(theme, `card-${name}`, (path) => captureCard(page, { messageId, path }));
    }
  }
} catch (error) {
  failure = error;
  console.error(`\n採取が中断した: ${error.message}`);
} finally {
  if (page) {
    try {
      const removed = await sweepShotFixtures(page);
      log(`\n見本データを削除: ${removed.join(", ") || "なし"}`);
    } catch (error) {
      console.error(`見本データの後始末に失敗した（手で消すこと）: ${error.message}`);
    }
    page.close();
  }
  await closeBrowser();
  foundryProc.kill();
}

log(`\n${"─".repeat(60)}`);
if (failure) {
  console.error(`採取 NG: ${shots}枚まで撮って中断した`);
  process.exit(1);
}
if (shots === 0) {
  console.error("1枚も撮れなかった");
  process.exit(1);
}
log(`採取 OK: ${shots}枚を ${OUT}/ に出した`);
