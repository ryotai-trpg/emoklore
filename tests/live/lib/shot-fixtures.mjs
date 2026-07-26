// スクリーンショット用の見本データ。
//
// `verify:live` の fixture（`fixtures.mjs`）は判定の配線を見るための最小構成で、技能が
// 3本しか無い。見た目の判断は**中身が詰まっていないと写らない**（行の密度、長い名前の
// 切り詰め、印の並び、桁の違う数値）ので、採取用には別に用意する。
//
// 印は名前ではなくフラグで付ける（理由は config.mjs の `SHOT_FLAG`）。
import { SHOT_FLAG } from "./config.mjs";

/** 見本データの名前。採取側（`shots.mjs` のエントリ）と共有する */
export const SHOT_NAMES = {
  character: "玖珂 灯里",
  npc: "聞き込み相手",
  kai: "階段の影",
  weapon: "特殊警棒",
  armor: "厚手のコート",
  customSkill: "残響感応",
  howling: "幻視",
};

/**
 * 前回の残骸を消す。作る前と撮り終わりの両方で呼ぶ。
 *
 * 採取は途中で止めることが多い（撮れた絵を見て止める）ので、作る前にも必ず掃除する。
 * 残ったまま作ると同名のアクターが並び、どちらを撮ったのか分からなくなる。
 *
 * **消すのは印の付いたものだけ。** 名前で消すと、たまたま同じ名前のアクターを
 * 手で作っていた人のデータまで巻き込む。
 */
export const sweepShotFixtures = (page) =>
  page.eval(async (flag) => {
    const marked = (doc) => doc.flags?.[flag.scope]?.[flag.key] === true;
    const removed = [];

    // カードを先に消す。発言者の突き合わせにアクターが要る
    const messages = game.messages.contents.filter(marked);
    if (messages.length > 0) {
      await ChatMessage.implementation.deleteDocuments(messages.map((m) => m.id));
      removed.push(`カード${messages.length}件`);
    }

    for (const actor of game.actors.contents.filter(marked)) {
      removed.push(actor.name);
      await actor.delete();
    }

    return removed;
  }, SHOT_FLAG);

/** いまチャット欄にある最後のメッセージ。ここから先に増えたぶんが採取の産物になる */
export const messageMarker = (page) => page.eval(() => game.messages.contents.at(-1)?.id ?? null);

/**
 * 印を付ける前後で増えたメッセージに、まとめて印を付ける。
 *
 * **撮る対象だけに付けるのでは足りない。** 共鳴の連鎖は結果カードのほかに判定の
 * ロールも流すので、撮るidだけを数えると1件ずつ取り残していく。
 */
export const markShotMessages = (page, marker) =>
  page.eval(
    async (flag, after) => {
      const all = game.messages.contents;
      const start = after ? all.findIndex((m) => m.id === after) + 1 : 0;
      const produced = all.slice(start);

      for (const message of produced) await message.setFlag(flag.scope, flag.key, true);
      return produced.length;
    },
    SHOT_FLAG,
    marker,
  );

export const createShotFixtures = (page) =>
  page.eval(
    async (flag, names) => {
      const flags = { [flag.scope]: { [flag.key]: true } };
      const made = [];

      // --- 共鳴者 -------------------------------------------------------
      //
      // 能力値は「ばらけている」ことに意味がある。全部同じだと目標値の桁が揃って、
      // 列がずれる問題が写らない。上限は6（rules/limits.ts）
      const char = await Actor.implementation.create({
        name: names.character,
        type: "character",
        flags,
        system: {
          kana: "くが あかり",
          characteristics: {
            physical: { value: 4 },
            dexterity: { value: 3 },
            mentality: { value: 5 },
            sensitivity: { value: 6 },
            intelligence: { value: 5 },
            charisma: { value: 3 },
            sociality: { value: 4 },
            fortune: { value: 2 },
          },
          emotions: {
            surface: "curiosity",
            hidden: "possession",
            root: "selfAssertion",
            acquired: ["destruction"],
          },
          biography: {
            age: "17",
            gender: "女性",
            occupation: "高校生（新聞部）",
            hometown: "神奈川県",
            appearance: "背は低い。癖のある髪を無理やり結んでいる。",
            personality: "人懐こく見えて、踏み込まれると黙る",
            background: "幼いころに一度だけ「向こう側」を見ている。",
            importantPeople: "姉（行方不明）",
            likesAndDislikes: "好き: 炭酸 ／ 嫌い: 静かすぎる部屋",
            note: "<p>備考はリッチテキスト。<strong>強調</strong>や<em>斜体</em>が入る。</p><p>2段落目。折り返しの見え方を確かめるために、ある程度の長さを持たせてある。</p>",
          },
        },
      });
      made.push(char.name);

      // 技能はレベルを散らす。閲覧モードは修得済みだけを出すので、ここの本数が
      // そのまま一覧の密度になる。特化つき・エクストラ（★）・長い名前を混ぜる。
      // HPは1桁・最大値は2桁にして、桁の違いがヘッダの幅に出る形にしておく
      await char.update({
        "system.skills.search.level": 1,
        "system.skills.insight.level": 2,
        "system.skills.keenObservation.level": 3,
        "system.skills.psychology.level": 2,
        "system.skills.specializedKnowledge.level": 2,
        "system.skills.specializedKnowledge.specialization": "民俗学",
        "system.skills.martialArt.level": 1,
        "system.skills.martialArt.specialization": "合気道",
        "system.skills.spiritualSense.level": 2,
        "system.skills.strongLuck.level": 1,
        "system.skills.computer.level": 3,
        "system.skills.stealth.level": 1,
        "system.resources.hp.value": 9,
        "system.resources.mp.value": 10,
        "system.resources.resonance.value": 4,
      });

      // カスタム技能は3区分を1本ずつ。閲覧モードでは base だけがチップ列へ回り、
      // 残り2本が技能リストに並ぶ（`buildSkillsContext` の振り分け）
      await char.createEmbeddedDocuments("Item", [
        {
          name: "都市伝説",
          type: "skill",
          system: { category: "normal", characteristicOptions: ["intelligence"], level: 2 },
        },
        {
          name: names.customSkill,
          type: "skill",
          system: {
            category: "extra",
            characteristicOptions: ["sensitivity", "mentality"],
            characteristic: "sensitivity",
            level: 1,
          },
        },
        {
          name: "土地勘",
          type: "skill",
          system: { category: "base", characteristicOptions: ["intelligence"] },
        },
        // 武器は参照技能が通常技能のものと基本技能のものを1本ずつ
        {
          name: names.weapon,
          type: "weapon",
          system: { skill: "martialArt", attackPower: "1d6", equipped: true },
        },
        { name: "投擲用の石", type: "weapon", system: { skill: "throw", attackPower: "2" } },
        {
          name: names.armor,
          type: "armor",
          system: { defense: 2, coverage: "胴・腕", equipped: true },
        },
        {
          name: names.howling,
          type: "howling",
          system: {
            category: "denial",
            effect: "<p>視覚を使う技能での判定は成功数-1。</p>",
            recovery: { note: "シナリオ中継続", skills: ["base:self", "skill:psychology"] },
          },
        },
      ]);

      // --- 人間NPC ------------------------------------------------------
      const npc = await Actor.implementation.create({
        name: names.npc,
        type: "npc",
        flags,
        system: { characteristics: { physical: { value: 3 }, intelligence: { value: 5 } } },
      });
      made.push(npc.name);
      await npc.update({
        "system.skills.search.level": 2,
        "system.skills.debate.level": 1,
        "system.skills.insider.level": 3,
      });

      // --- 怪異 ---------------------------------------------------------
      //
      // 攻撃は判定ありと判定なしを1本ずつ。#110 の「判定なし・成功数」の重複が
      // シートとカードの両方に写る
      const kai = await Actor.implementation.create({
        name: names.kai,
        type: "kai",
        flags,
        system: {
          initiative: 6,
          resources: { hp: { value: 24, max: 30 }, mp: { value: 5, max: 8 }, armor: 3 },
          emotions: ["selfAssertion", "sloth"],
          resonance: { intensity: 5, rise: "1" },
          mutation: "<p>階段の段数が合わなくなる。</p>",
          attacks: [
            {
              name: "引きずり込む",
              diceCount: 2,
              target: 7,
              damage: "@successd4+3",
              mpCost: 1,
              judgeless: false,
              fixedSuccess: 1,
            },
            {
              name: "沈降",
              diceCount: 0,
              target: 0,
              damage: "2",
              mpCost: 0,
              judgeless: true,
              fixedSuccess: 3,
            },
          ],
        },
      });
      made.push(kai.name);

      return made;
    },
    SHOT_FLAG,
    SHOT_NAMES,
  );
