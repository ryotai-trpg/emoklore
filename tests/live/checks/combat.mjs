// イニシアチブのCombat統合。登録・基準の保存と式の配線・トラッカーのバー・生存リマインダを見る。
import { TAG } from "../lib/config.mjs";
import { assertInPage } from "../lib/harness.mjs";

export const title = "イニシアチブ";

export async function run({ page, check }) {
  await check("Combat・Combatant・トラッカーが差し替わっている", () =>
    assertInPage(page, () => {
      const combat = CONFIG.Combat.documentClass?.name;
      const combatant = CONFIG.Combatant.documentClass?.name;
      const tracker = CONFIG.ui.combat?.name;
      const model = CONFIG.Combat.dataModels.standard?.name;
      const ok =
        combat === "EmokloreCombat" &&
        combatant === "EmokloreCombatant" &&
        tracker === "EmokloreCombatTracker" &&
        model === "CombatDataModel";
      return {
        ok,
        detail: `Combat=${combat} Combatant=${combatant} tracker=${tracker} model=${model}`,
      };
    }),
  );

  await check("基準を保存し、式から初速を算出する", () =>
    assertInPage(
      page,
      async (tag) => {
        const char = await Actor.implementation.create({
          name: `${tag}_initiative`,
          type: "character",
          system: { characteristics: { physical: { value: 5 } } },
        });
        // スピードとダイブを取らせて技能の加算が式に出るか見る（既定は 身体+スピード）
        await char.update({ "system.skills.speed.level": 3, "system.skills.dive.level": 2 });

        const combat = await Combat.implementation.create({});
        try {
          // _initializeSource で全Combatが standard に寄り、基準の既定は 身体+スピード
          if (combat.type !== "standard") {
            return { ok: false, detail: `Combatが standard でない: ${combat.type}` };
          }
          if (combat.system.characteristic !== "physical" || combat.system.skill !== "speed") {
            return { ok: false, detail: `基準の既定が 身体+スピード でない` };
          }

          await combat.createEmbeddedDocuments("Combatant", [{ actorId: char.id }]);
          const cid = combat.combatants.contents[0].id;

          // 既定（身体5 + スピード3 = 8。@initiative 経由）
          await combat.rollInitiative([cid]);
          const def = combat.combatants.get(cid).initiative;

          // 技能を足す非既定の基準（身体5 + ダイブ2 = 7。@skills.X.level の経路）
          await combat.update({ system: { characteristic: "physical", skill: "dive" } });
          await combat.recomputeAll();
          const dive = combat.combatants.get(cid).initiative;

          // 技能なし（器用1のみ）。全員再算出で既存の値も振り直す
          await combat.update({ system: { characteristic: "dexterity", skill: "" } });
          await combat.recomputeAll();
          const arrest = combat.combatants.get(cid).initiative;

          const ok = def === 8 && dive === 7 && arrest === 1;
          return { ok, detail: `既定=${def} / 身体+ダイブ=${dive} / 器用=${arrest}` };
        } finally {
          await combat.delete();
          await char.delete();
        }
      },
      TAG,
    ),
  );

  await check("トラッカーに基準バーが描かれる", () =>
    assertInPage(page, async () => {
      const combat = await Combat.implementation.create({});
      try {
        await combat.activate();
        await ui.combat.render({ force: true });
        const bar = await window.__waitFor(
          () => ui.combat.element?.querySelector(".em-initiative-basis"),
          { soft: true, label: "基準バーの描画" },
        );
        if (!bar) return { ok: false, detail: "基準バーが描かれない" };

        // GMなので基準を選ぶ select が出る。未解決の翻訳キーが混じっていないか見る
        const hasSelect = !!bar.querySelector('[data-em="preset"]');
        const unresolved = window.__findUnresolvedKeys(bar);
        const ok = hasSelect && unresolved.length === 0;
        return {
          ok,
          detail: ok
            ? "バーとプリセット選択が描かれた（未解決キーなし）"
            : `select=${hasSelect} 未解決キー=${unresolved.join(", ")}`,
        };
      } finally {
        await combat.delete();
      }
    }),
  );

  await check("ラウンド終了で心肺停止者に生存リマインダが出て、ボタンで判定が飛ぶ", () =>
    assertInPage(
      page,
      async (tag) => {
        const char = await Actor.implementation.create({
          name: `${tag}_arrest`,
          type: "character",
        });
        await char.toggleStatusEffect("cardiacArrest", { active: true });

        const combat = await Combat.implementation.create({});
        try {
          await combat.createEmbeddedDocuments("Combatant", [{ actorId: char.id }]);
          await combat.startCombat();

          const before = game.messages.contents.length;
          await combat.nextRound();

          const reminder = await window.__waitFor(
            () => game.messages.contents.slice(before).find((m) => m.type === "survivalReminder"),
            { soft: true, label: "生存リマインダの作成" },
          );
          if (!reminder) return { ok: false, detail: "リマインダが出ない" };
          if (!reminder.content.includes('data-action="rollSurvival"')) {
            return { ok: false, detail: `判定ボタンが出ていない: ${reminder.content}` };
          }

          // DOMのボタンを押し、リスナ→ACTIONS→rollSkill の配線ごと確かめる
          const button = await window.__waitFor(
            () =>
              document.querySelector(
                `[data-message-id="${reminder.id}"] button[data-action="rollSurvival"]`,
              ),
            { soft: true, label: "リマインダボタンの描画" },
          );
          if (!button) return { ok: false, detail: "描画されたカードにボタンが無い" };

          const rollsBefore = game.messages.contents.length;
          button.click();
          const rolled = await window.__waitFor(
            () =>
              game.messages.contents.length > rollsBefore && game.messages.contents.at(-1).isRoll,
            { soft: true, label: "生存判定の実行" },
          );
          if (!rolled) return { ok: false, detail: "ボタンを押しても〈生存〉判定が飛ばない" };

          return { ok: true, detail: "リマインダ→ボタンで〈生存〉判定が飛んだ" };
        } finally {
          await combat.delete();
          await char.delete();
        }
      },
      TAG,
    ),
  );
}
