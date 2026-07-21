// 武器。シートの描画と、カードの 攻撃 → ダメージ → 適用 の連鎖を見る。
import { TAG } from "../lib/config.mjs";
import { assertInPage, DICE, pinDice } from "../lib/harness.mjs";

export const title = "武器";

export async function run({ page, check }) {
  await check("武器シートが描画される", () =>
    assertInPage(
      page,
      async (tag) => {
        const item = game.actors.getName(`${tag}_char`).items.getName(`${tag}_刀`);
        await item.sheet.render(true);
        await window.__waitFor(() => item.sheet.rendered && item.sheet.element, {
          label: "武器シートの描画",
        });

        const el = item.sheet.element;
        const expected = Object.keys(item.sheet.constructor.PARTS);
        const missing = expected.filter(
          (part) => !el.querySelector(`[data-application-part="${part}"]`),
        );
        const leaked = window.__findUnresolvedKeys(el);

        await item.sheet.close();

        if (missing.length > 0) {
          return { ok: false, detail: `描かれていないパート: ${missing.join(", ")}` };
        }
        if (leaked.length > 0) {
          return { ok: false, detail: `未解決の翻訳キー: ${[...new Set(leaked)].join(", ")}` };
        }
        return { ok: true, detail: `${expected.length}パート（${expected.join(" ")}）` };
      },
      TAG,
    ),
  );

  for (const [label, suffix] of [
    ["通常技能", "刀"],
    ["基本技能", "手榴弾"],
  ]) {
    await check(`武器カードが 攻撃→ダメージ と進む（${label}）`, () =>
      assertInPage(
        page,
        async (tag, name) => {
          const a = game.actors.getName(`${tag}_char`);
          const item = a.items.getName(`${tag}_${name}`);
          if (!item) return { ok: false, detail: `${name} が無い` };
          if (!item.isWeapon()) return { ok: false, detail: "isWeapon() が false" };

          const msg = await item.use();
          const id = msg.id;
          await window.__waitFor(() => game.messages.get(id), { label: "武器カードの作成" });

          // update のたびにモデルは作り直されるので、毎回メッセージから取り直す
          await game.messages.get(id).system.rollAttack();
          const afterAttack = await window.__waitFor(
            () => {
              const sys = game.messages.get(id).system;
              return sys.successCount === null ? null : sys;
            },
            { soft: true, label: "攻撃判定の成功数" },
          );
          if (!afterAttack) {
            return { ok: false, detail: "攻撃判定のあとも successCount が null" };
          }

          await game.messages.get(id).system.rollDamage();
          await window.__waitFor(() => game.messages.get(id).system.damageTotal !== null, {
            soft: true,
            label: "ダメージの反映",
          });
          const card = game.messages.get(id).system;
          const ok = card.damageTotal !== null && card.buttons.canApplyDamage;
          return {
            ok,
            detail: ok
              ? `成功数${afterAttack.successCount} → ${game.messages.get(id).rolls.at(-1).formula} = ${card.damageTotal}`
              : `damageTotal=${card.damageTotal} buttons=${JSON.stringify(card.buttons)}`,
          };
        },
        TAG,
        suffix,
      ),
    );
  }

  await check("ダメージがトークンのアクターに適用される", () =>
    assertInPage(
      page,
      async (tag) => {
        const world = game.actors.getName(`${tag}_target`);
        const token = game.scenes.active?.tokens.contents.find((t) => t.actor?.id === world.id);
        if (!token) return { ok: false, detail: "ターゲット用トークンがシーンに無い" };

        token.object.setTarget(true, { releaseOthers: true });
        await window.__waitFor(() => game.user.targets.size > 0, { label: "ターゲットの設定" });

        const card = game.messages.contents.reverse().find((m) => m.system?.damageTotal != null);
        if (!card) return { ok: false, detail: "ダメージ済みのカードが無い" };

        // 非リンクトークンでは token.actor が合成アクターで、ワールドのアクターとは別物。
        // 適用先はこちらでなければならない（ワールド側を減らすと、同じ元データから
        // 置いた雑魚が全員まとめて減る。docs/architecture.md「GMへの委譲」を参照）
        const before = token.actor.system.resources.hp.value;
        const worldBefore = world.system.resources.hp.value;
        const damage = card.system.damageTotal;

        await card.system.applyDamage();
        await window.__waitFor(() => token.actor.system.resources.hp.value !== before, {
          soft: true,
          label: "HPの反映",
        });

        const after = token.actor.system.resources.hp.value;
        const worldAfter = world.system.resources.hp.value;

        if (after !== Math.max(0, before - damage)) {
          return {
            ok: false,
            detail: `トークン側のHPが動いていない: ${before} → ${after}（ダメージ${damage}）`,
          };
        }
        if (worldAfter !== worldBefore) {
          return {
            ok: false,
            detail: `ワールドのアクターまで減っている: ${worldBefore} → ${worldAfter}`,
          };
        }
        return {
          ok: true,
          detail: `トークン ${before} → ${after}（ダメージ${damage}）／ワールド ${worldBefore} のまま`,
        };
      },
      TAG,
    ),
  );

  // ここから先は必ず外れる出目にする。命中しなかったときの分岐を見るため
  await pinDice(page, DICE.alwaysMiss);

  await check("攻撃が外れたらダメージを振れない", () =>
    assertInPage(
      page,
      async (tag) => {
        const a = game.actors.getName(`${tag}_char`);
        const msg = await a.items.getName(`${tag}_刀`).use();
        const id = msg.id;
        await window.__waitFor(() => game.messages.get(id), { label: "武器カードの作成" });
        await game.messages.get(id).system.rollAttack();
        await window.__waitFor(() => game.messages.get(id).system.successCount !== null, {
          soft: true,
          label: "攻撃判定の成功数",
        });

        const card = game.messages.get(id).system;
        // 成功数0以下ならダイスの数が決まらないので、式としても成り立たない
        const ok =
          card.successCount !== null && card.successCount < 1 && !card.buttons.canRollDamage;
        return {
          ok,
          detail: ok
            ? `成功数${card.successCount} でダメージボタンが出ない`
            : `成功数${card.successCount} buttons=${JSON.stringify(card.buttons)}`,
        };
      },
      TAG,
    ),
  );

  await pinDice(page, DICE.alwaysHit);

  // base は skill から引き直さないと、フックが技能を差し替えたときに
  // 差し替え前の base と組み合わされる（docs/architecture.md の武器カードのフック）。
  // 通常技能から基本技能へまたぐ差し替えでしか出ないので、境界をまたがせる
  await check("フックが技能を差し替えても基本技能の別が食い違わない", () =>
    assertInPage(
      page,
      async (tag) => {
        const a = game.actors.getName(`${tag}_char`);
        // 刀は martialArt（通常技能）。これを throw（基本技能）に差し替える
        const hookId = Hooks.on("emoklore.preRollAttack", (_message, config) => {
          config.skill = "throw";
        });

        try {
          const msg = await a.items.getName(`${tag}_刀`).use();
          const id = msg.id;
          await window.__waitFor(() => game.messages.get(id), { label: "武器カードの作成" });

          await game.messages.get(id).system.rollAttack();
          const card = await window.__waitFor(
            () => {
              const sys = game.messages.get(id).system;
              return sys.successCount === null ? null : sys;
            },
            { soft: true, label: "差し替え後の攻撃判定" },
          );

          if (!card) {
            // 差し替え前の base（false）で基本技能の表を引けず、判定が飛ばなかった
            return { ok: false, detail: "差し替え後に判定が飛ばず successCount が null のまま" };
          }

          const roll = game.messages.get(id).rolls.at(-1);
          const expected = a.system.baseSkills.throw.target;
          // em はカスタムDieの修飾子なので、目標値の指定だけを見る
          const ok = roll.terms[0].faces === 10 && roll.formula.endsWith(`<=${expected}`);
          return {
            ok,
            detail: ok
              ? `〈＊投擲〉の目標値${expected}で振られた（${roll.formula}）`
              : `目標値が基本技能側でない: ${roll.formula}（期待 <=${expected}）`,
          };
        } finally {
          Hooks.off("emoklore.preRollAttack", hookId);
        }
      },
      TAG,
    ),
  );
}
