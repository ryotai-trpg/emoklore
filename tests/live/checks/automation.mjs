// 自動化の設定。**切ったときに自動処理が止まること**を見る。
//
// 既定（すべて有効）の側は他のチェックが通ることで確かめられているので、ここは
// 切った側だけを見る。設定は必ず元へ戻す（検証用データと同じ扱い）。
import { TAG } from "../lib/config.mjs";
import { assertInPage, DICE, pinDice } from "../lib/harness.mjs";

export const title = "自動化の設定";

export async function run({ page, check }) {
  // 出目を固定して damageTotal を決定的にする
  await pinDice(page, DICE.alwaysHit);

  await check("防具の自動軽減を切ると装備中の防具が乗らない", () =>
    assertInPage(
      page,
      async (tag) => {
        const world = game.actors.getName(`${tag}_target`);
        const armor = world.items.getName(`${tag}_鎧`);
        if (!armor) return { ok: false, detail: "防具フィクスチャが無い" };
        await armor.update({ "system.equipped": true });

        const token = game.scenes.active?.tokens.contents.find((t) => t.actor?.id === world.id);
        token.object.setTarget(true, { releaseOthers: true });
        await window.__waitFor(() => game.user.targets.size > 0, { label: "ターゲットの設定" });

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

        await game.settings.set("emoklore", "autoArmorReduction", false);
        try {
          await token.actor.update({
            "system.resources.hp.value": token.actor.system.resources.hp.max,
          });
          const before = token.actor.system.resources.hp.value;

          const targets = [...game.user.targets].map((t) => t.actor);
          await game.system.api.applyDamageAndReport(targets, damage);

          // 防具が乗らないので、ダメージがそのまま引かれる
          const expected = Math.max(0, before - damage);
          const after = token.actor.system.resources.hp.value;
          if (after !== expected) {
            return {
              ok: false,
              detail: `防具が乗ってしまった: ${before} → ${after}（期待 ${expected}）`,
            };
          }
          return { ok: true, detail: `ダメージ${damage}が素通し（HP ${before} → ${after}）` };
        } finally {
          await game.settings.set("emoklore", "autoArmorReduction", true);
          await armor.update({ "system.equipped": false });
        }
      },
      TAG,
    ),
  );

  await check("HP境界の案内を切ると案内が出ない", () =>
    assertInPage(
      page,
      async (tag) => {
        const world = game.actors.getName(`${tag}_target`);
        const token = game.scenes.active?.tokens.contents.find((t) => t.actor?.id === world.id);
        token.object.setTarget(true, { releaseOthers: true });
        await window.__waitFor(() => game.user.targets.size > 0, { label: "ターゲットの設定" });

        await game.settings.set("emoklore", "autoHpBoundaryNotice", false);
        try {
          // HPちょうどぶんを与えて0にする。案内が生きていれば心肺停止のボタンが出る場面
          const before = token.actor.system.resources.hp.value;
          const targets = [...game.user.targets].map((t) => t.actor);
          await game.system.api.applyDamageAndReport(targets, before);

          const applied = game.messages.contents.at(-1);
          if (applied.type !== "damageApplied") {
            return { ok: false, detail: `結果カードが出ていない: ${applied.type}` };
          }
          if (applied.content.includes("data-status-id=")) {
            return { ok: false, detail: `案内が出てしまった: ${applied.content}` };
          }
          return { ok: true, detail: `HP ${before} → 0 でも状態付与のボタンが出ない` };
        } finally {
          await game.settings.set("emoklore", "autoHpBoundaryNotice", true);
          await token.actor.update({
            "system.resources.hp.value": token.actor.system.resources.hp.max,
          });
        }
      },
      TAG,
    ),
  );

  await check("生存リマインダを切るとラウンド終了で出ない", () =>
    assertInPage(
      page,
      async (tag) => {
        const char = await Actor.implementation.create({
          name: `${tag}_noreminder`,
          type: "character",
        });
        await char.toggleStatusEffect("cardiacArrest", { active: true });

        const combat = await Combat.implementation.create({});
        await game.settings.set("emoklore", "autoSurvivalReminder", false);
        try {
          await combat.createEmbeddedDocuments("Combatant", [{ actorId: char.id }]);
          await combat.startCombat();

          const before = game.messages.contents.length;
          await combat.nextRound();

          // 「出ないこと」は条件で待てないので、出るのを待って時間切れになるのが正常
          const reminder = await window.__waitFor(
            () => game.messages.contents.slice(before).find((m) => m.type === "survivalReminder"),
            { soft: true, timeout: 1000, label: "生存リマインダの作成" },
          );
          if (reminder) return { ok: false, detail: "切ってもリマインダが出た" };

          return { ok: true, detail: "心肺停止でもリマインダが出ない" };
        } finally {
          await game.settings.set("emoklore", "autoSurvivalReminder", true);
          await combat.delete();
          await char.delete();
        }
      },
      TAG,
    ),
  );

  await check("ダメージ結果の公開範囲をDLだけに絞れる", () =>
    assertInPage(
      page,
      async (tag) => {
        const world = game.actors.getName(`${tag}_target`);
        const token = game.scenes.active?.tokens.contents.find((t) => t.actor?.id === world.id);
        token.object.setTarget(true, { releaseOthers: true });
        await window.__waitFor(() => game.user.targets.size > 0, { label: "ターゲットの設定" });

        await game.settings.set("emoklore", "damageResultVisibility", "gm");
        try {
          const targets = [...game.user.targets].map((t) => t.actor);
          await game.system.api.applyDamageAndReport(targets, 1);

          const applied = game.messages.contents.at(-1);
          if (applied.type !== "damageApplied") {
            return { ok: false, detail: `結果カードが出ていない: ${applied.type}` };
          }
          const gmIds = game.users.filter((u) => u.isGM).map((u) => u.id);
          const whispered = gmIds.length > 0 && gmIds.every((id) => applied.whisper.includes(id));
          if (!whispered) {
            return { ok: false, detail: `DLへの限定になっていない: whisper=${applied.whisper}` };
          }
          return { ok: true, detail: `whisper=${applied.whisper.length}人（DLのみ）` };
        } finally {
          await game.settings.set("emoklore", "damageResultVisibility", "public");
          await token.actor.update({
            "system.resources.hp.value": token.actor.system.resources.hp.max,
          });
        }
      },
      TAG,
    ),
  );
}
