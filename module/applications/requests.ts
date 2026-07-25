/**
 * DLからの判定要求。カードのボタンのハンドラと、要求を作る入口。
 *
 * ハンドラは判定を駆動する（`documents/` を呼ぶ）ので `data/` には置かず、`emoklore.ts` の
 * init から `SkillRequestModel.ACTIONS` に登録する。`data/` から `documents/` への逆依存を
 * 作らないためで、怪異の攻撃カードと同じ形（architecture.md 課題5）。
 */

import { isBaseSkillKey } from "../config/base-skills";
import { isSkillKey } from "../config/skills";
import type { SkillRef } from "../data/character";
import type { SkillRequestModel } from "../data/messages/skill-request";
import { createSkillRequestMessage } from "../utils/chat";
import { resolveActingActor } from "../utils/targets";
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
