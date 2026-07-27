// チャットカードの見本を作る。
//
// カードは「作らないと画面に無い」ので、シートと違って撮る前に一度動かす必要がある。
// 経路は `checks/` が実際に通しているものと同じにしてある——別の作り方をすると、
// 撮れた絵が実プレイで出るものと違いうる。
//
// 各シーンは作ったメッセージのidを返す。撮るのは `lib/shots.mjs` の `captureCard`。
// 見本のアクターは `window.__shot.actor()` から引く（印まで見る同じ道を通る）。

import { DICE } from "./harness.mjs";
import { SHOT_NAMES } from "./shot-fixtures.mjs";

/**
 * 判定カード。要求の有無と、成功／失敗で見え方が変わる。
 *
 * #101（成功数を出す）は**失敗のときにどう見せるか**まで含む判断なので、
 * 出目を落とした1枚も撮っておく。
 */
const skillRolls = (page) =>
  page.eval(
    async (names, hit, miss) => {
      const actor = window.__shot.actor(names.character);
      const ref = { kind: "skill", key: "keenObservation" };

      const plain = await actor.rollSkill(ref);
      const required = await actor.rollSkill(ref, { requiredSuccess: 7 });

      // 失敗の1枚だけ出目を落とす。終わったら必ず戻す（以降のシーンが全部ずれる）
      CONFIG.Dice.randomUniform = () => miss;
      const failed = await actor.rollSkill(ref);
      CONFIG.Dice.randomUniform = () => hit;

      return {
        "skill-roll": plain.id,
        "skill-roll-required": required.id,
        "skill-roll-failed": failed.id,
      };
    },
    SHOT_NAMES,
    DICE.alwaysHit,
    DICE.alwaysMiss,
  );

/** 武器カード。攻撃→ダメージと押して、育ちきった姿を撮る */
const weaponCard = (page) =>
  page.eval(async (names) => {
    const weapon = window.__shot.actor(names.character).items.getName(names.weapon);

    const message = await weapon.use();
    const id = message.id;
    await window.__waitFor(() => game.messages.get(id), { label: "武器カードの作成" });

    // update のたびにサブタイプは作り直されるので、毎回メッセージから取り直す
    await window.__cardAction(game.messages.get(id), "rollAttack");
    await window.__waitFor(() => game.messages.get(id).rolls.length >= 1, { label: "攻撃ロール" });
    await window.__cardAction(game.messages.get(id), "rollDamage");
    await window.__waitFor(() => game.messages.get(id).rolls.length >= 2, {
      label: "ダメージロール",
    });

    return { "weapon-card": id };
  }, SHOT_NAMES);

/**
 * 怪異の攻撃カード。3枚を撮る。
 *
 * 判定ありは「出しただけ」と「判定→ダメージまで押した」の2枚。押す前の姿は
 * カードが最初に出る形なので、ここが読めるかどうかが実際の卓での見え方になる。
 * 判定なしは判定を持たないぶん、押す回数が1つ少ない姿になる。
 */
const kaiAttacks = (page) =>
  page.eval(async (names) => {
    const kai = window.__shot.actor(names.kai);

    const fresh = await kai.useKaiAttack(0);

    const grown = await kai.useKaiAttack(0);
    await window.__waitFor(() => game.messages.get(grown.id), { label: "怪異の攻撃カードの作成" });
    await window.__cardAction(game.messages.get(grown.id), "rollAttack");
    await window.__waitFor(() => game.messages.get(grown.id).rolls.length >= 1, {
      label: "判定ロール",
    });
    await window.__cardAction(game.messages.get(grown.id), "rollDamage");
    await window.__waitFor(() => game.messages.get(grown.id).rolls.length >= 2, {
      label: "ダメージロール",
    });

    const judgeless = await kai.useKaiAttack(1);
    await window.__waitFor(() => game.messages.get(judgeless.id), { label: "判定なしのカード" });
    await window.__cardAction(game.messages.get(judgeless.id), "rollDamage");
    await window.__waitFor(() => game.messages.get(judgeless.id).rolls.length >= 1, {
      label: "ダメージロール",
    });

    return {
      "kai-attack-fresh": fresh.id,
      "kai-attack": grown.id,
      "kai-attack-judgeless": judgeless.id,
    };
  }, SHOT_NAMES);

/** DLからの判定要求カード。チャット欄のボタン → ダイアログ、が実際の経路 */
const skillRequest = (page) =>
  page.eval(async () => {
    const findDialog = () =>
      [...foundry.applications.instances.values()].find(
        (x) => x.constructor.name.includes("Dialog") && x.rendered,
      );

    document.querySelector("#chat-controls .em-request-skill").click();
    const dialog = await window.__waitFor(findDialog, { label: "要求作成ダイアログ" });

    // ベース技能の併記は既定でオン。〈観察眼〉を選ぶと〈＊知覚〉が足され、
    // 印つきの並びが1枚に収まる（#82 の判断に要る）
    const form = dialog.element.querySelector("form") ?? dialog.element;
    form.querySelector('option[value="skill:keenObservation"]').selected = true;
    form.querySelector('[name="requiredSuccess"]').value = "2";
    form.querySelector('[name="bonus"]').value = "1";

    const before = game.messages.size;
    dialog.element.querySelector("button[data-action=ok]").click();
    await window.__waitFor(() => game.messages.size > before, { label: "要求カード" });

    return { "skill-request": game.messages.contents.at(-1).id };
  });

/**
 * 共鳴判定の要求 → 結果 → ハウリング抽選の3枚。
 *
 * 3枚が1本に繋がっているので、まとめて1つのシーンにする。結果カードは要求カードの
 * ボタンからしか出ず、抽選カードは結果がトリプル以上でないと出ない。
 *
 * 共鳴表は同梱のコンペンディウム（汎用共鳴表「因縁タイプ」）を借りる。
 */
const resonanceChain = (page) =>
  page.eval(async (names) => {
    const findDialog = () =>
      [...foundry.applications.instances.values()].find(
        (x) => x.constructor.name.includes("Dialog") && x.rendered,
      );

    const table = await game.packs.get("emoklore.resonance-tables").getDocument("emokTableInnen1a");
    const kai = window.__shot.actor(names.kai);
    await kai.update({ "system.resonanceTable": table.uuid });

    const actor = window.__shot.actor(names.character);
    // 共鳴値2＝2ダイス。出目1固定なので成功数4でトリプル以上になり、抽選まで進む
    const resonance = actor.system.resources.resonance.value;
    await actor.update({ "system.resources.resonance.value": 2 });

    // 誰で振るかを固定する。選択中のトークンが先に当たるので、担当を決めてから解除する
    const previous = game.user.character;
    await game.user.update({ character: actor.id });
    for (const token of [...(canvas?.tokens?.controlled ?? [])]) token.release();

    try {
      await kai.sheet.render(true);
      await window.__setMode(kai.sheet, "play");
      kai.sheet.element.querySelector("[data-action=requestResonance]").click();

      const dialog = await window.__waitFor(findDialog, { label: "要求作成ダイアログ" });
      const form = dialog.element.querySelector("form") ?? dialog.element;
      form.elements.namedItem("intensity").value = "9";

      let before = game.messages.size;
      dialog.element.querySelector("button[data-action=ok]").click();
      await window.__waitFor(() => game.messages.size > before, { label: "要求カード" });
      await kai.sheet.close();

      const request = game.messages.contents.at(-1);
      const requestCard = await window.__waitFor(
        () => document.querySelector(`[data-message-id="${request.id}"] .em-resonance-request`),
        { label: "要求カードの描画" },
      );

      // 判定のロールと結果カードの2件が出る
      before = game.messages.size;
      requestCard.querySelector("[data-action=rollResonance]").click();
      await window.__waitFor(() => game.messages.size >= before + 2, { label: "判定と結果" });

      const outcome = game.messages.contents.at(-1);
      const drawButton = await window.__waitFor(
        () => document.querySelector(`[data-message-id="${outcome.id}"] [data-action=drawHowling]`),
        { label: "共鳴表を引くボタン" },
      );

      before = game.messages.size;
      drawButton.click();
      await window.__waitFor(() => game.messages.size > before, { label: "反応カード" });

      return {
        "resonance-request": request.id,
        "resonance-outcome": outcome.id,
        "howling-draw": game.messages.contents.at(-1).id,
      };
    } finally {
      // 共鳴判定は共鳴値を上げる。撮る前の姿に戻さないと、シートの絵が実行ごとに変わる
      await game.user.update({ character: previous?.id ?? null });
      await actor.update({ "system.resources.resonance.value": resonance });
    }
  }, SHOT_NAMES);

/**
 * カードの見本を全部作る。戻り値は `{ 名前: メッセージid }`。
 *
 * 並び順に意味がある。共鳴の連鎖は `game.user.character` を触るので最後に回す。
 */
export const createCardScenes = async (page) => {
  const ids = {};
  for (const scene of [skillRolls, weaponCard, kaiAttacks, skillRequest, resonanceChain]) {
    Object.assign(ids, await scene(page));
  }
  return ids;
};
