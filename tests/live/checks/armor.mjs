// 防具。装備中の防御力がダメージ適用の引き算に自動で乗る配線を見る。
import { TAG } from "../lib/config.mjs";
import { assertInPage, DICE, pinDice } from "../lib/harness.mjs";

export const title = "防具";

export async function run({ page, check }) {
  await check("防具シートが描画される", () =>
    assertInPage(
      page,
      async (tag) => {
        const item = game.actors.getName(`${tag}_target`).items.getName(`${tag}_鎧`);
        if (!item) return { ok: false, detail: "防具フィクスチャが無い" };

        await item.sheet.render(true);
        await window.__waitFor(() => item.sheet.rendered && item.sheet.element, {
          label: "防具シートの描画",
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

  // 出目を固定して damageTotal を決定的にする
  await pinDice(page, DICE.alwaysHit);

  await check("装備中の防具が1クリック適用で自動で引かれる", () =>
    assertInPage(
      page,
      async (tag) => {
        const world = game.actors.getName(`${tag}_target`);
        await world.items.getName(`${tag}_鎧`).update({ "system.equipped": true });

        // カードを起こして 攻撃→ダメージ と進める
        const a = game.actors.getName(`${tag}_char`);
        const msg = await a.items.getName(`${tag}_刀`).use();
        const id = msg.id;
        await window.__waitFor(() => game.messages.get(id), { label: "武器カードの作成" });
        await window.__cardAction(game.messages.get(id), "rollAttack");
        await window.__waitFor(() => game.messages.get(id).system.successCount !== null, {
          soft: true,
          label: "攻撃判定",
        });
        await window.__cardAction(game.messages.get(id), "rollDamage");
        await window.__waitFor(() => game.messages.get(id).system.damageTotal !== null, {
          soft: true,
          label: "ダメージ",
        });
        const damage = game.messages.get(id).system.damageTotal;

        const token = game.scenes.active?.tokens.contents.find((t) => t.actor?.id === world.id);
        token.object.setTarget(true, { releaseOthers: true });
        await window.__waitFor(() => game.user.targets.size > 0, { label: "ターゲットの設定" });

        // 防具はワールド側に持たせている。合成アクターの装備合計にも波及していること
        if (token.actor.system.armor !== 2) {
          return { ok: false, detail: `装備合計が2でない: ${token.actor.system.armor}` };
        }

        await token.actor.update({
          "system.resources.hp.value": token.actor.system.resources.hp.max,
        });
        const before = token.actor.system.resources.hp.value;

        await window.__cardAction(game.messages.get(id), "applyDamage");

        const expected = Math.max(0, before - Math.max(0, damage - 2));
        const after = token.actor.system.resources.hp.value;
        if (after !== expected) {
          return {
            ok: false,
            detail: `HPが期待とずれた: ${before} → ${after}（期待 ${expected}）`,
          };
        }

        const applied = game.messages.contents.at(-1);
        if (applied.system?.targets?.[0]?.armor !== 2) {
          return { ok: false, detail: "適用結果に防具の値が焼き込まれていない" };
        }
        if (!applied.content.includes("防具 2")) {
          return { ok: false, detail: `行に防具の内訳が出ていない: ${applied.content}` };
        }
        return { ok: true, detail: `ダメージ${damage} - 防具2 → HP ${before} → ${after}` };
      },
      TAG,
    ),
  );

  await check("チェック外し相当の armor 上書きが届く", () =>
    assertInPage(
      page,
      async (tag) => {
        const world = game.actors.getName(`${tag}_target`);
        const token = game.scenes.active?.tokens.contents.find((t) => t.actor?.id === world.id);
        token.object.setTarget(true, { releaseOthers: true });
        await window.__waitFor(() => game.user.targets.size > 0, { label: "ターゲットの設定" });

        // 前のチェックのカード（装備は付けたまま）を使い回す
        const card = game.messages.contents.reverse().find((m) => m.system?.damageTotal != null);
        if (!card) return { ok: false, detail: "ダメージ済みのカードが無い" };
        const damage = card.system.damageTotal;

        await token.actor.update({
          "system.resources.hp.value": token.actor.system.resources.hp.max,
        });
        const before = token.actor.system.resources.hp.value;

        // ダイアログの操作は目視の領分。UIを迂回して「全部外した」相当の armor: 0 を送る
        const targets = [...game.user.targets].map((t) => t.actor);
        await game.system.api.applyDamageAndReport(targets, damage, { reduction: 1, armor: 0 });

        const expected = Math.max(0, before - Math.max(0, damage - 1));
        const after = token.actor.system.resources.hp.value;
        if (after !== expected) {
          return {
            ok: false,
            detail: `HPが期待とずれた: ${before} → ${after}（期待 ${expected}）`,
          };
        }

        const applied = game.messages.contents.at(-1);
        const ok = applied.content.includes("軽減 1") && !applied.content.includes("防具");
        return {
          ok,
          detail: ok
            ? `装備中でも armor:0 なら防具が乗らない（HP ${before} → ${after}）`
            : `内訳が期待とずれた: ${applied.content}`,
        };
      },
      TAG,
    ),
  );

  await check("軽減と防具の内訳が併記される", () =>
    assertInPage(
      page,
      async (tag) => {
        const world = game.actors.getName(`${tag}_target`);
        const token = game.scenes.active?.tokens.contents.find((t) => t.actor?.id === world.id);
        token.object.setTarget(true, { releaseOthers: true });
        await window.__waitFor(() => game.user.targets.size > 0, { label: "ターゲットの設定" });

        const card = game.messages.contents.reverse().find((m) => m.system?.damageTotal != null);
        const damage = card.system.damageTotal;

        await token.actor.update({
          "system.resources.hp.value": token.actor.system.resources.hp.max,
        });
        const before = token.actor.system.resources.hp.value;

        // armor は送らない。既定（装備合計の自動）に軽減が重なる経路
        const targets = [...game.user.targets].map((t) => t.actor);
        await game.system.api.applyDamageAndReport(targets, damage, { reduction: 1 });

        const expected = Math.max(0, before - Math.max(0, damage - 1 - 2));
        const after = token.actor.system.resources.hp.value;
        if (after !== expected) {
          return {
            ok: false,
            detail: `HPが期待とずれた: ${before} → ${after}（期待 ${expected}）`,
          };
        }

        const applied = game.messages.contents.at(-1);
        const ok = applied.content.includes("軽減 1 ＋ 防具 2");
        return {
          ok,
          detail: ok
            ? `ダメージ${damage} - 軽減1 - 防具2 → HP ${before} → ${after}`
            : `内訳が期待とずれた: ${applied.content}`,
        };
      },
      TAG,
    ),
  );

  await check("装備を外すと数えない", () =>
    assertInPage(
      page,
      async (tag) => {
        const world = game.actors.getName(`${tag}_target`);
        // 後片付けを兼ねて外す（他のチェックのHP検算に影響を残さない）
        await world.items.getName(`${tag}_鎧`).update({ "system.equipped": false });

        const token = game.scenes.active?.tokens.contents.find((t) => t.actor?.id === world.id);
        token.object.setTarget(true, { releaseOthers: true });
        await window.__waitFor(() => game.user.targets.size > 0, { label: "ターゲットの設定" });

        const card = game.messages.contents.reverse().find((m) => m.system?.damageTotal != null);
        const damage = card.system.damageTotal;

        await token.actor.update({
          "system.resources.hp.value": token.actor.system.resources.hp.max,
        });
        const before = token.actor.system.resources.hp.value;

        await window.__cardAction(game.messages.get(card.id), "applyDamage");

        const expected = Math.max(0, before - damage);
        const after = token.actor.system.resources.hp.value;
        const ok = after === expected && !game.messages.contents.at(-1).content.includes("防具");
        return {
          ok,
          detail: ok
            ? `未装備は素通し（HP ${before} → ${after}）`
            : `HP ${before} → ${after}（期待 ${expected}）`,
        };
      },
      TAG,
    ),
  );
}
