/**
 * DLからの判定要求。カードのボタンのハンドラと、要求を作る入口。
 *
 * ハンドラは判定を駆動する（`documents/` を呼ぶ）ので `data/` には置かず、`emoklore.ts` の
 * init から `SkillRequestModel.ACTIONS` に登録する。`data/` から `documents/` への逆依存を
 * 作らないためで、怪異の攻撃カードと同じ形（architecture.md 課題5）。
 */

import { createResonanceOutcomeMessage } from "../chat/resonance-outcome";
import { createResonanceRequestMessage } from "../chat/resonance-request";
import { createSkillRequestMessage } from "../chat/skill-request";
import { isBaseSkillKey } from "../config/base-skills";
import { isSkillKey } from "../config/skills";
import type { CharacterDataModel, SkillRef } from "../data/character";
import type {
  ResonanceRequestModel,
  ResonanceRequestState,
} from "../data/messages/resonance-request";
import type { SkillRequestModel } from "../data/messages/skill-request";
import type { EmokloreRoll } from "../dice/emoklore-roll";
import type { EmokloreActor } from "../documents/actor";
import { raiseResonanceForActor } from "../documents/queries";
import { HOWLING_SUCCESS, POSSESSION_RISE, type ResonanceMatch } from "../rules/resonance-roll";
import { meetsRequirement } from "../rules/success";
import { matchEmotion } from "../utils/emotion";
import { resolveActingActor, resolveActingActors } from "../utils/targets";
import { promptResonanceRequest } from "./dialogs/resonance-request-dialog";
import { promptSkillRequest } from "./dialogs/skill-request-dialog";

/**
 * 要求された技能を、押した人のアクターで振る。
 *
 * カードには書き戻さない。DLが出したカードはPLから更新できないので、結果は
 * それぞれの判定メッセージとして出る。
 */
export async function rollRequested(this: SkillRequestModel, target: HTMLElement): Promise<void> {
  const ref = toSkillRef(target.dataset.kind, target.dataset.key);
  if (!ref) return;

  const actor = resolveActingActor();
  if (!actor) {
    ui.notifications?.warn("EMOKLORE.ChatMessage.skillRequest.NoActor", { localize: true });
    return;
  }
  if (!actor.isCharacterLike()) {
    ui.notifications?.warn("EMOKLORE.ChatMessage.skillRequest.NotCharacterLike", {
      localize: true,
    });
    return;
  }

  await actor.rollSkill(
    ref,
    { requiredSuccess: this.requiredSuccess },
    // 判定値修正はDLが状況で与えるものではないので0のまま
    { bonus: this.bonus, success: this.successMod, target: 0 },
  );
}

/** DLが判定要求を作ってチャットに出す。チャット欄のボタンから呼ばれる */
export async function requestSkillCheck(): Promise<void> {
  const input = await promptSkillRequest();
  if (!input) return;

  await createSkillRequestMessage(input);
}

/**
 * ボタンの dataset から判定の参照を組み立てる。
 *
 * dataset もカードの保存データも外から来た文字列なので、キーとして名乗る前に確かめる。
 * カスタム技能はアクター固有なので要求には入らない。
 */
function toSkillRef(kind: string | undefined, key: string | undefined): SkillRef | null {
  if (!key) return null;
  if (kind === "base") return isBaseSkillKey(key) ? { kind: "base", key } : null;
  if (kind === "skill") return isSkillKey(key) ? { kind: "skill", key } : null;

  return null;
}

/**
 * 共鳴判定・憑依判定を、選択中のトークン（無ければ自分のアクター）で振る。
 *
 * 1体ずつ順に処理する。判定・共鳴値の更新・結果カードが体ごとに1組で並ぶので、
 * 誰がどうなったかがチャットの並びだけで追える。
 */
export async function rollRequestedResonance(this: ResonanceRequestModel): Promise<void> {
  const actors = resolveActingActors().filter((actor) => actor.isCharacter());
  if (actors.length === 0) {
    ui.notifications?.warn("EMOKLORE.ChatMessage.resonanceRequest.NoActor", { localize: true });
    return;
  }

  for (const actor of actors) {
    await rollResonanceFor(actor, this);
  }
}

/** 1体ぶんの共鳴判定と、そのあと始末 */
async function rollResonanceFor(
  actor: EmokloreActor & { system: CharacterDataModel },
  request: ResonanceRequestModel,
): Promise<void> {
  // 一致度はDLの強制指定が最優先。無ければ指定された感情から自動で決める
  const match = isResonanceMatch(request.forcedMatch)
    ? request.forcedMatch
    : matchEmotion(actor.system.getOwnedEmotions(), [...request.emotions]);

  const message = await actor.rollResonance(request.intensity, match);
  const roll = (message as { rolls?: EmokloreRoll[] } | undefined)?.rolls?.[0];
  if (!roll) return;

  const successCount = roll.successCount;
  // 憑依判定は成否によらず1上がる。共鳴判定は成功したときだけ上昇値ぶん
  const rise = request.possessionMode
    ? POSSESSION_RISE
    : successCount > 0
      ? await evaluateRise(request.rise)
      : 0;

  const changed = await raiseResonanceForActor(actor, rise);
  if (!changed) {
    ui.notifications?.warn("EMOKLORE.ChatMessage.resonanceRequest.NoGM", { localize: true });
    return;
  }

  await createResonanceOutcomeMessage(actor, {
    actorUuid: actor.uuid ?? null,
    name: actor.name ?? "",
    successCount,
    rise: changed.after - changed.before,
    before: changed.before,
    after: changed.after,
    // 憑依判定ではハウリングが起きない（ルールブックの変種の規定）
    howling: !request.possessionMode && successCount >= HOWLING_SUCCESS,
    possessionReached:
      request.possessionMode &&
      meetsRequirement(successCount, actor.system.characteristics.mentality.value),
    kaiUuid: request.kaiUuid,
  });
}

/**
 * 上昇値を数に落とす。ダイス式も受ける（公式シナリオに 上昇1D3 の例）。
 *
 * 式が壊れていたら0にする。DLの打ち間違いで判定そのものが止まるより、上がらないほうがまし。
 */
async function evaluateRise(formula: string): Promise<number> {
  if (!formula) return 0;

  const asNumber = Number(formula);
  if (Number.isInteger(asNumber)) return Math.max(asNumber, 0);

  if (!foundry.dice.Roll.validate(formula)) return 0;

  const roll = new foundry.dice.Roll(formula);
  await roll.evaluate();

  return Math.max(roll.total ?? 0, 0);
}

/** DLからの共鳴判定要求を作ってチャットに出す。怪異シートとチャット欄から呼ばれる */
export async function requestResonanceCheck(
  preset: Partial<ResonanceRequestState> = {},
): Promise<void> {
  const input = await promptResonanceRequest(preset);
  if (!input) return;

  await createResonanceRequestMessage(input);
}

/** 保存データの一致度は文字列なので、使う前に確かめる */
const isResonanceMatch = (value: string): value is ResonanceMatch =>
  value === "none" || value === "root" || value === "completely";
