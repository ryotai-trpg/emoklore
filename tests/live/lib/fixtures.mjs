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
