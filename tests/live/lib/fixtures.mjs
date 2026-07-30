// 検証用データの作成と後片付け。
//
// ワールドの手作りデータに依存すると、他人の環境で落ちる。毎回自分で作って自分で消す。
import { IMPORTED_NAME, TAG } from "./config.mjs";

export const createFixtures = (page) =>
  page.eval(async (tag) => {
    const made = [];

    const char = await Actor.implementation.create({
      name: `${tag}_char`,
      type: "character",
      system: { characteristics: { physical: { value: 5 }, intelligence: { value: 5 } } },
    });
    made.push(char.name);
    // ストレングスは近接ダメージへの加算が式に出るかを見るために取らせる
    await char.update({
      "system.skills.search.level": 2,
      "system.skills.martialArt.level": 2,
      "system.skills.strength.level": 2,
    });

    // 参照技能が通常技能のものと基本技能のものを1本ずつ。両方の経路を通すため
    await char.createEmbeddedDocuments("Item", [
      { name: `${tag}_刀`, type: "weapon", system: { skill: "martialArt", attackPower: "1d6" } },
      { name: `${tag}_手榴弾`, type: "weapon", system: { skill: "throw", attackPower: "2" } },
    ]);

    const target = await Actor.implementation.create({
      name: `${tag}_target`,
      type: "character",
    });
    made.push(target.name);
    // 防具は装備を外して持たせる。装備したままだと武器・境界チェックのHP検算が
    // 全部ずれる（「未装備は軽減に数えない」の回帰も兼ねる）。防具チェックが装備して戻す
    await target.createEmbeddedDocuments("Item", [
      { name: `${tag}_鎧`, type: "armor", system: { defense: 2, equipped: false } },
    ]);
    const importee = await Actor.implementation.create({
      name: `${tag}_import`,
      type: "character",
    });
    made.push(importee.name);

    // 人間NPC: 能力値＋技能で共鳴者と同じ計算を振れることを見るため、技能を1本取らせる
    const npc = await Actor.implementation.create({
      name: `${tag}_npc`,
      type: "npc",
      system: { characteristics: { physical: { value: 4 } } },
    });
    made.push(npc.name);
    await npc.update({ "system.skills.search.level": 2 });
    // 武器を1本。NPCシートの武器行は、開く・消すを共鳴者シートと同じ基底の
    // ハンドラで処理する。行の解決が効いていることを見るために要る。
    // 防具はアイテムタブの装備トグルが system.armor に効くことを見るため（未装備で持たせる）
    await npc.createEmbeddedDocuments("Item", [
      {
        name: `${tag}_鉄パイプ`,
        type: "weapon",
        system: { skill: "martialArt", attackPower: "2" },
      },
      {
        name: `${tag}_破れた外套`,
        type: "armor",
        system: { defense: 1, equipped: false },
      },
    ]);

    // 怪異: 固定初速・装甲・共鳴感情・共鳴プリセット・攻撃（自由ダメージ式のD4と判定なし）
    const kai = await Actor.implementation.create({
      name: `${tag}_kai`,
      type: "kai",
      system: {
        initiative: 6,
        resources: { hp: { value: 30, max: 30 }, mp: { value: 5, max: 5 }, armor: 5 },
        emotions: ["selfAssertion"],
        resonance: { intensity: 5, rise: "1" },
        attacks: [
          {
            name: `${tag}_粘液手`,
            diceCount: 2,
            target: 7,
            damage: "@successd4+3",
            mpCost: 0,
            judgeless: false,
            fixedSuccess: 1,
          },
          {
            name: `${tag}_侵食`,
            diceCount: 0,
            target: 0,
            damage: "1",
            mpCost: 0,
            judgeless: true,
            fixedSuccess: 3,
          },
          // ダメージ式が空の攻撃。怪異の attacks は固有技能も兼ねるので、判定だけの
          // ものが普通にある。カードにダメージのボタンが出ないことを見るために置く
          {
            name: `${tag}_威嚇`,
            diceCount: 2,
            target: 7,
            damage: "",
            mpCost: 0,
            judgeless: false,
            fixedSuccess: 1,
          },
        ],
      },
    });
    made.push(kai.name);

    // ダメージ適用はターゲット（トークン）を経由するので、シーンとトークンが要る
    let scene = game.scenes.getName(`${tag}_scene`);
    if (!scene) {
      scene = await Scene.implementation.create({
        name: `${tag}_scene`,
        width: 1000,
        height: 1000,
      });
    }
    await scene.activate();
    await window.__waitFor(() => canvas?.ready && canvas.scene?.id === scene.id, {
      label: "シーンの有効化",
    });
    await scene.createEmbeddedDocuments("Token", [
      { name: target.name, actorId: target.id, x: 500, y: 500, disposition: -1 },
    ]);
    // トークンはDocumentが出来てから canvas に描かれるので、描画側まで待つ
    await window.__waitFor(
      () => canvas.tokens?.placeables.some((t) => t.document.actorId === target.id),
      { label: "トークンの配置" },
    );

    return made;
  }, TAG);

export const removeFixtures = (page) =>
  page.eval(
    async (tag, importedName) => {
      const removed = [];
      for (const actor of game.actors.contents.filter((a) => a.name.startsWith(tag))) {
        removed.push(actor.name);
        await actor.delete();
      }
      // 取り込みの検証でアクター名が変わるので、印では拾えない。名前で消す
      const stray = game.actors.getName(importedName);
      if (stray) {
        removed.push(importedName);
        await stray.delete();
      }
      for (const scene of game.scenes.contents.filter((s) => s.name.startsWith(tag))) {
        removed.push(scene.name);
        await scene.delete();
      }
      return removed;
    },
    TAG,
    IMPORTED_NAME,
  );
