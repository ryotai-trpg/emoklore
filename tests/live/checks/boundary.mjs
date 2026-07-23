// HP/MP境界の案内。適用結果カードの案内文と、状態を付与するボタンの配線を見る。
import { TAG } from "../lib/config.mjs";
import { assertInPage, DICE, pinDice } from "../lib/harness.mjs";

export const title = "境界の案内";

export async function run({ page, check }) {
  // 出目を固定して damageTotal を決定的にする（全ダイス1: ダメージは最大HP未満に収まる）
  await pinDice(page, DICE.alwaysHit);

  await check("HP0で心肺停止の案内が出て、ボタンで状態が付く", () =>
    assertInPage(
      page,
      async (tag) => {
        // カードを起こして 攻撃→ダメージ まで進める（ページ側で完結させるため毎回組む）
        const a = game.actors.getName(`${tag}_char`);
        const msg = await a.items.getName(`${tag}_刀`).use();
        const id = msg.id;
        await window.__waitFor(() => game.messages.get(id), { label: "武器カードの作成" });
        await game.messages.get(id).system.rollAttack();
        await window.__waitFor(() => game.messages.get(id).system.successCount !== null, {
          soft: true,
          label: "攻撃判定",
        });
        await game.messages.get(id).system.rollDamage();
        await window.__waitFor(() => game.messages.get(id).system.damageTotal !== null, {
          soft: true,
          label: "ダメージ",
        });
        const damage = game.messages.get(id).system.damageTotal;

        const world = game.actors.getName(`${tag}_target`);
        const token = game.scenes.active?.tokens.contents.find((t) => t.actor?.id === world.id);
        token.object.setTarget(true, { releaseOthers: true });
        await window.__waitFor(() => game.user.targets.size > 0, { label: "ターゲットの設定" });

        // ちょうど0で止まるHPから撃つ。ダメージが最大HPを超えていても 0 には落ちる
        const max = token.actor.system.resources.hp.max;
        await token.actor.update({ "system.resources.hp.value": Math.min(damage, max) });
        const before = token.actor.system.resources.hp.value;

        const targets = [...game.user.targets].map((t) => t.actor);
        await game.messages.get(id).system.applyDamageTo(targets);

        const applied = game.messages.contents.at(-1);
        if (applied.type !== "damageApplied") {
          return { ok: false, detail: `適用結果が damageApplied でない: ${applied.type}` };
        }
        if (!applied.content.includes('data-status-id="cardiacArrest"')) {
          return { ok: false, detail: `心肺停止のボタンが出ていない: ${applied.content}` };
        }

        // ボタンをDOMから押し、リスナ→ACTIONS→toggleStatusEffect の配線ごと確かめる。
        // メッセージのDOM描画は作成より遅れて届くので、現れるまで待つ
        const button = await window.__waitFor(
          () =>
            document.querySelector(
              `[data-message-id="${applied.id}"] button[data-action="applyStatus"]`,
            ),
          { soft: true, label: "案内ボタンの描画" },
        );
        if (!button) return { ok: false, detail: "描画されたカードにボタンが無い" };
        button.click();
        const got = await window.__waitFor(() => token.actor.statuses.has("cardiacArrest"), {
          soft: true,
          label: "心肺停止の付与",
        });
        if (!got) return { ok: false, detail: "ボタンを押しても心肺停止が付かない" };

        // 後片付け。次のチェックと通常運転に影響を残さない
        await token.actor.toggleStatusEffect("cardiacArrest", { active: false });
        return { ok: true, detail: `HP ${before} → 0 で案内、ボタンで付与できた` };
      },
      TAG,
    ),
  );

  await check("一度に半分以上を失うと気絶判定の案内が出る", () =>
    assertInPage(
      page,
      async (tag) => {
        // 直前のチェックが作ったダメージ済みカードを使い回す
        const card = game.messages.contents.reverse().find((m) => m.system?.damageTotal != null);
        if (!card) return { ok: false, detail: "ダメージ済みのカードが無い" };
        const damage = card.system.damageTotal;

        const world = game.actors.getName(`${tag}_target`);
        const token = game.scenes.active?.tokens.contents.find((t) => t.actor?.id === world.id);
        token.object.setTarget(true, { releaseOthers: true });
        await window.__waitFor(() => game.user.targets.size > 0, { label: "ターゲットの設定" });

        const max = token.actor.system.resources.hp.max;
        if (damage >= max) {
          return { ok: false, detail: `ダメージ${damage}が最大HP${max}以上で前提が崩れた` };
        }

        // ダメージのちょうど2倍（上限は最大HP）から撃てば、半分以上を失って0では止まらない
        await token.actor.update({ "system.resources.hp.value": Math.min(damage * 2, max) });
        const before = token.actor.system.resources.hp.value;

        const targets = [...game.user.targets].map((t) => t.actor);
        await card.system.applyDamageTo(targets);

        const applied = game.messages.contents.at(-1);
        const ok =
          applied.content.includes('data-status-id="unconscious"') &&
          !applied.content.includes('data-status-id="cardiacArrest"');
        return {
          ok,
          detail: ok
            ? `HP ${before} → ${before - damage} で気絶判定の案内`
            : `期待した案内が出ていない: ${applied.content}`,
        };
      },
      TAG,
    ),
  );

  await check("MPが0にまたぐと失神の案内が出て、ボタンで状態が付く", () =>
    assertInPage(
      page,
      async (tag) => {
        const world = game.actors.getName(`${tag}_target`);
        await world.update({ "system.resources.mp.value": 2 });
        await world.update({ "system.resources.mp.value": 0 });

        // 案内は _onUpdate から非同期に作られ、update の完了を待っても届いていない。
        // メッセージが現れるまで待つ
        const notice = await window.__waitFor(
          () => {
            const m = game.messages.contents.at(-1);
            return m?.type === "damageApplied" && m.system?.resource === "mp" ? m : null;
          },
          { soft: true, label: "MPの案内メッセージ" },
        );
        if (!notice) {
          return {
            ok: false,
            detail: `MPの案内が出ていない: type=${game.messages.contents.at(-1)?.type}`,
          };
        }
        if (!notice.content.includes('data-status-id="faint"')) {
          return { ok: false, detail: `失神のボタンが出ていない: ${notice.content}` };
        }

        const button = await window.__waitFor(
          () =>
            document.querySelector(
              `[data-message-id="${notice.id}"] button[data-action="applyStatus"]`,
            ),
          { soft: true, label: "案内ボタンの描画" },
        );
        if (!button) return { ok: false, detail: "描画されたカードにボタンが無い" };
        button.click();
        const got = await window.__waitFor(() => world.statuses.has("faint"), {
          soft: true,
          label: "失神の付与",
        });
        if (!got) return { ok: false, detail: "ボタンを押しても失神が付かない" };

        // 0のままの再更新では出さない（境界をまたいだときだけ）。
        // 「出ない」ことの確認なので、非同期の作成が届きうる猶予だけ置いて数を見る
        const count = game.messages.contents.length;
        await world.update({ "system.resources.mp.value": 0 });
        await new Promise((resolve) => setTimeout(resolve, 500));
        if (game.messages.contents.length !== count) {
          return { ok: false, detail: "0のままの更新でも案内が出てしまう" };
        }

        await world.toggleStatusEffect("faint", { active: false });
        await world.update({ "system.resources.mp.value": 2 });
        return { ok: true, detail: "MP 2 → 0 で案内、ボタンで付与、0のままでは出ない" };
      },
      TAG,
    ),
  );
}
