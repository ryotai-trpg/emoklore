// スクリーンショット採取の道具。
//
// **合否を持たない。** 見た目の良し悪しは機械で判定しないので、ここがするのは
// 「決めた条件で撮って、撮れなかったら落ちる」ところまで。判断は人がPNGを見て行う。
//
// ページ側の道具は `window.__shot` にまとめて仕込む（`harness.mjs` の
// `installPageHelpers` と同じ形）。`page.eval` は関数のソースを送って評価するだけで
// クロージャを持てないので、寸法などの定数は引数で渡す。

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { SHOT_FLAG } from "./config.mjs";

/** 出力の倍率。等倍だと文字の詰まりが読めず、密度の判断に使えない */
const SCALE = 2;

/** 切り出しに足す余白。枠の影のぶん。ぴったり切ると影が途中で切れる */
const BLEED = 12;

/** シートを置く位置。毎回同じ場所に置いて、前後比較で座標がぶれないようにする */
const ORIGIN = { left: 40, top: 40 };

/** PNGの下限（バイト）。これを割るなら真っ白か真っ黒で、撮れていない */
const MIN_BYTES = 2000;

/**
 * ページ側に採取の道具を仕込む。
 *
 * `installPageHelpers`（`harness.mjs`）が先に済んでいる前提で、`__waitFor` と
 * `__setMode` を使う。
 */
export const installShotHelpers = (page) =>
  page.eval((flag) => {
    /**
     * 対象のApplicationを引く。
     *
     * 名前だけでなく**印も見る**。見本データの名前は普通の名前なので、ワールドに
     * 同名のアクターが居ると取り違える。
     *
     * **見つからなければ投げる。** 空振りしたまま撮ると、前に撮ったシートが写った
     * PNGが「別の対象のもの」として残り、撮れていないことに気付けない。
     */
    const findActor = (name) => {
      const found = game.actors.contents.find(
        (a) => a.name === name && a.flags?.[flag.scope]?.[flag.key] === true,
      );
      if (!found) throw new Error(`見本のアクターが見つからない: ${name}`);
      return found;
    };

    const resolve = ({ actor, item }) => {
      const found = findActor(actor);
      if (!item) return found.sheet;

      const embedded = found.items.getName(item);
      if (!embedded) throw new Error(`アイテムが見つからない: ${actor} / ${item}`);
      return embedded.sheet;
    };

    const rectOf = (el) => {
      const { x, y, width, height } = el.getBoundingClientRect();
      return { x, y, width, height };
    };

    window.__shot = {
      /** 見本のアクター。カードを作るシーン（`shot-scenes.mjs`）からも使う */
      actor: findActor,

      /** テーマを当てる。body のクラスが入れ替わるので、シートもチャット欄も追従する */
      theme(name) {
        const config = foundry.utils.deepClone(game.settings.get("core", "uiConfig"));
        // 設定そのものは書き換えない（`game.settings.set` を通さない）。撮るあいだだけ当てる
        config.colorScheme = { applications: name, interface: name };
        game.configureUI(config);
        return document.body.className;
      },

      /** シートを開いて、中身が描けるまで待つ */
      async open(spec) {
        const sheet = resolve(spec);
        await sheet.render(true);
        await window.__waitFor(
          () => sheet.rendered && sheet.element?.querySelector(".window-content *"),
          { label: `${spec.actor}${spec.item ? ` / ${spec.item}` : ""} の描画` },
        );
        return sheet.element.className;
      },

      async close(spec) {
        const sheet = resolve(spec);
        if (sheet.rendered) await sheet.close();
        return true;
      },

      /**
       * 撮る直前の姿に整えて、切り出す矩形を返す。
       *
       * 順序に意味がある。モード切替は描き直しを伴い、タブ切替は `_refit` で位置を
       * 触りうるので、**寸法を当てるのは最後**にする。
       */
      async layout(spec, { mode, tab, tabGroup, width, height, probe, left, top }) {
        const sheet = resolve(spec);

        if (mode) await window.__setMode(sheet, mode);
        if (tab) sheet.changeTab(tab, tabGroup, { updatePosition: false });

        // 本体は `_updatePosition` で computed の min-width に clamp する
        // （client/applications/api/application.mjs の `_updatePosition`）。
        // 下限より狭い姿を見るには、先にインラインで打ち消す。インラインは
        // スタイルシートに勝つので、これで実際の破綻点を観測できる
        sheet.element.style.minWidth = probe ? "0px" : "";

        sheet.setPosition({ width, height, left, top });

        // 幅を変えると中身が折り返して高さが動く。落ち着くまで1フレーム待つ
        await new Promise((r) => requestAnimationFrame(() => r()));

        const rect = rectOf(sheet.element);
        if (rect.width < 1 || rect.height < 1) {
          throw new Error(`切り出す矩形が空: ${JSON.stringify(rect)}`);
        }
        return rect;
      },

      /**
       * チャット欄を撮れる状態にする。
       *
       * **サイドバーは畳まれていることがある**（クライアント設定に残る）。畳んだ
       * サイドバーはチャット欄を表示領域の外へ送り出すだけで、要素の矩形は0にならない。
       * つまり広げずに撮ると「何も写っていないPNGが正常に出来る」ので、先に広げる。
       */
      async openChat() {
        const wasExpanded = ui.sidebar.expanded;
        ui.sidebar.toggleExpanded(true);
        ui.sidebar.changeTab("chat", "primary");

        const chat = await window.__waitFor(
          () => {
            const el = document.querySelector("#chat");
            const rect = el?.getBoundingClientRect();
            // 開く動きが終わるまで待つ。表示領域の右端に収まったら落ち着いている
            return rect && rect.right <= document.documentElement.clientWidth + 1 ? rect : null;
          },
          { label: "チャット欄を開く" },
        );
        return { wasExpanded, width: chat.width };
      },

      /**
       * チャットカードの矩形。
       *
       * サイドバーに置かれた実物を測る。カードが実際に読まれる幅がそこなので、
       * 幅は指定しない。
       */
      async cardRect(messageId) {
        const el = await window.__waitFor(
          () => document.querySelector(`#chat .chat-message[data-message-id="${messageId}"]`),
          { label: `カードの描画 ${messageId}` },
        );
        el.scrollIntoView({ block: "center" });
        await new Promise((r) => requestAnimationFrame(() => r()));

        const rect = rectOf(el);
        if (rect.width < 1 || rect.height < 1) throw new Error(`カードの矩形が空: ${messageId}`);

        // 表示領域の外は撮っても白紙になる。**切れたまま出さずに落とす** —
        // 途中で切れたカードは、一見それらしく写るぶん見落としやすい
        const view = document.documentElement;
        const outside =
          rect.x < 0 ||
          rect.y < 0 ||
          rect.x + rect.width > view.clientWidth + 1 ||
          rect.y + rect.height > view.clientHeight + 1;
        if (outside) {
          throw new Error(
            `カードが表示領域からはみ出している（${JSON.stringify(rect)} / ` +
              `表示領域 ${view.clientWidth}×${view.clientHeight}）。表示領域を高くする`,
          );
        }
        return rect;
      },
    };

    return true;
  }, SHOT_FLAG);

/** ビューポートからはみ出さない範囲で、矩形を余白ぶん広げる */
const withBleed = ({ x, y, width, height }) => ({
  x: Math.max(0, x - BLEED),
  y: Math.max(0, y - BLEED),
  width: width + BLEED * 2,
  height: height + BLEED * 2,
  scale: SCALE,
});

/**
 * 撮って書き出す。
 *
 * **撮れていないPNGは落とす。** ヘッドレスChromeは起動に失敗しても真っ黒な画像を
 * 返してくるので、バイト数の下限を置いておかないと「何も写っていない」が
 * 「全部撮れた」に化ける。
 */
const write = async (page, path, rect) => {
  mkdirSync(dirname(path), { recursive: true });
  const bytes = await page.shot(path, { clip: withBleed(rect) });
  if (bytes < MIN_BYTES) {
    throw new Error(`PNGが小さすぎる（${bytes}バイト）。撮れていない: ${path}`);
  }
  return bytes;
};

export const setTheme = (page, theme) => page.eval((name) => window.__shot.theme(name), theme);

export const openSheet = (page, spec) => page.eval((s) => window.__shot.open(s), spec);

export const closeSheet = (page, spec) => page.eval((s) => window.__shot.close(s), spec);

export const openChat = (page) => page.eval(() => window.__shot.openChat());

/** シートを整えて撮る。戻り値は実際に写った寸法（要求した幅と違いうる） */
export const captureSheet = async (page, { spec, path, ...layout }) => {
  const rect = await page.eval((s, o) => window.__shot.layout(s, o), spec, {
    tabGroup: "primary",
    ...ORIGIN,
    ...layout,
  });
  await write(page, path, rect);
  return { width: Math.round(rect.width), height: Math.round(rect.height) };
};

/** チャットカードを撮る */
export const captureCard = async (page, { messageId, path }) => {
  const rect = await page.eval((id) => window.__shot.cardRect(id), messageId);
  await write(page, path, rect);
  return { width: Math.round(rect.width), height: Math.round(rect.height) };
};
