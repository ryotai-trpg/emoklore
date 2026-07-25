import { createRollMessage } from "../../chat/message";
import { systemPath } from "../../constants";
import { resolveSkillRef, type SkillRef } from "../../data/character";
import type { WeaponCardModel } from "../../data/messages/weapon-card";
import type { EmokloreActor } from "../../documents/actor";
import { normalizeReduction } from "../../rules/weapon-damage";
import { typedEntries } from "../../utils/object";
import { skillMarker } from "../../utils/skill";
import { resolveTargetActors } from "../../utils/targets";

export type DamageReductionInput = {
  reduction: number;
  /** 防具の上書き値。全チェックのままなら送らず、既定（装備合計を自動で）に任せる */
  armor?: number | undefined;
};

const TEMPLATE = systemPath("templates/apps/apply-damage.hbs");

/** 防御判定の既定。ルールブックの防御の例示が〈耐久〉 */
const DEFAULT_DEFENSE_SKILL = "skill:endurance";

/**
 * カードの「軽減して適用」ボタン。軽減値を尋ねてから適用する。
 *
 * `WeaponCardModel.ACTIONS` へは `module/emoklore.ts` の init が登録する。
 * ACTIONS はモジュールにも開いている拡張点で、ここから登録すれば
 * data/ から applications/ への import を作らずに済む。
 */
export async function applyDamageWithReduction(this: WeaponCardModel): Promise<void> {
  const amount = this.damageTotal;
  if (amount === null) return;

  // 対象は押した瞬間に凍結する。ダイアログを開いている間にターゲットを付け替えても、
  // 防御判定を振った相手と適用先が食い違わないようにするため
  const targets = resolveTargetActors();
  if (targets.length === 0) {
    ui.notifications?.warn("EMOKLORE.ChatMessage.weapon.NoTarget", { localize: true });
    return;
  }

  const input = await promptDamageReduction({
    amount,
    successCount: this.successCount,
    targets,
  });
  if (!input) return;

  await this.applyDamageTo(targets, { reduction: input.reduction, armor: input.armor });
}

/**
 * 軽減値を尋ねる。キャンセルされた場合は null を返す。
 *
 * 回避の成立（回避の成功数が攻撃の成功数以上なら無効化）は成功数の見比べで決まるので、
 * 参考に攻撃成功数を出し、成立していたらキャンセルで適用をやめてもらう。
 * リアクション専念の軽減2倍や回避回数の管理は自動化しない（DL裁量。注記の表示まで）。
 */
export async function promptDamageReduction({
  amount,
  successCount,
  targets,
}: {
  amount: number;
  successCount: number | null;
  targets: EmokloreActor[];
}): Promise<DamageReductionInput | null> {
  // 防御判定のショートカットと防具のチェックは対象1体のときだけ。複数の対象は
  // 各自の軽減・装備が別々で、1つの入力に流し込めない（1体ずつ適用してもらう）
  const defender = targets.length === 1 ? (targets[0] ?? null) : null;
  const armorPieces = defender ? listEquippedArmor(defender) : [];

  const content = await foundry.applications.handlebars.renderTemplate(TEMPLATE, {
    summary: game.i18n.localize("EMOKLORE.ApplyDamage.Summary", {
      target:
        defender?.name ??
        game.i18n.localize("EMOKLORE.ApplyDamage.TargetCount", { count: targets.length }),
      damage: amount,
      successCount: successCount ?? "?",
    }),
    canRollDefense: !!defender,
    defenseSkillGroups: listDefenseSkillGroups(),
    armorPieces,
    hasArmorChoices: armorPieces.length > 0,
  });

  // prompt は static メソッドで中身が this.wait(...) なので、変数に取り出して呼ぶと
  // thisが外れて壊れる。必ずメソッドとして呼ぶこと。
  // キャストが要るのは、本体JSDocの引数型に config.ok が含まれていないため
  const result = await foundry.applications.api.DialogV2.prompt({
    // DialogV2 の既定の classes は ["dialog"] だけで emoklore も standard-form も
    // 付かない。本体のフォーム体系に乗せるには明示的に渡す必要がある
    classes: ["emoklore", "standard-form"],
    window: { title: game.i18n.localize("EMOKLORE.ApplyDamage.Title") },
    content,
    ok: {
      label: game.i18n.localize("EMOKLORE.ChatMessage.weapon.Apply"),
      callback: (_event: Event, button: HTMLElement) => readInput(button),
    },
    // content 内の data-action は ApplicationV2 のアクション機構がここに振り分ける
    actions: {
      rollDefense: (_event: Event, button: HTMLElement) => rollDefense(defender, button),
    },
    // 閉じられた場合はnullで返る。rejectCloseで例外にすると本物のエラーを握り潰しやすい
    rejectClose: false,
  } as Parameters<typeof foundry.applications.api.DialogV2.prompt>[0]);

  return (result as DamageReductionInput | null) ?? null;
}

type DefenseSkillOption = { value: string; label: string; selected: boolean };
type DefenseSkillGroup = { label: string; options: DefenseSkillOption[] };

/**
 * 防御判定に使う技能の選択肢。
 *
 * ルールブックの防御は「〈耐久〉などの技能」で、どの技能を認めるかはDL裁量。
 * こちらで候補を絞るとルールの発明になるので、通常技能とベース技能を全部出す。
 * カスタム技能は対象アクターの所持アイテム依存なので、必要になったら足す。
 */
function listDefenseSkillGroups(): DefenseSkillGroup[] {
  // CONFIG.EMOKLORE の label は i18nInit で翻訳済み（performPreLocalization）
  const skills = typedEntries(CONFIG.EMOKLORE.skills).map(([key, config]) => ({
    value: `skill:${key}`,
    label: `${skillMarker(false, config.isExtra ?? false)}${config.label}`,
    selected: `skill:${key}` === DEFAULT_DEFENSE_SKILL,
  }));
  const baseSkills = typedEntries(CONFIG.EMOKLORE.baseSkills).map(([key, config]) => ({
    value: `base:${key}`,
    label: `${skillMarker(true, false)}${config.label}`,
    selected: false,
  }));

  return [
    { label: game.i18n.localize("EMOKLORE.Item.skill.Category.normal"), options: skills },
    { label: game.i18n.localize("EMOKLORE.Item.skill.Category.base"), options: baseSkills },
  ];
}

/** 防御判定を振ってチャットに流し、成功数を軽減値の入力へ書き込む */
async function rollDefense(defender: EmokloreActor | null, button: HTMLElement): Promise<void> {
  // 対象が複数のときは fieldset ごと disabled にしていて、ここには来ない
  if (!defender) return;

  const form = (button as HTMLButtonElement).form as HTMLFormElement;
  const selected = (form.elements.namedItem("defenseSkill") as HTMLSelectElement).value;
  const ref = parseSkillValue(selected);
  if (!ref) return;

  // 連打で二重に振らせない。カードのボタンと同じ扱い
  const el = button as HTMLButtonElement;
  el.disabled = true;
  try {
    const { roll, flavor } = await defender.buildSkillRoll(ref);
    await createRollMessage({ actor: defender, flavor, roll });
    (form.elements.namedItem("reduction") as HTMLInputElement).value = String(
      normalizeReduction(roll.successCount),
    );
  } finally {
    el.disabled = false;
  }
}

/** select の値（`skill:endurance` / `base:athletic`）を検証して SkillRef へ */
function parseSkillValue(value: string): SkillRef | null {
  const [kind, key] = value.split(":");
  if (kind !== "skill" && kind !== "base") return null;

  return resolveSkillRef(key ?? "", { base: kind === "base" });
}

/** チェックボックス1つぶんの防具。value に防御力を持たせ、readInput が合計する */
type ArmorPieceContext = { defense: number; label: string };

/** 対象の装備中防具。部位の条件が書いてあれば添えて、外すかの判断材料にする */
function listEquippedArmor(defender: EmokloreActor): ArmorPieceContext[] {
  return [...defender.items]
    .filter((item) => item.isArmor())
    .filter((item) => item.system.equipped)
    .map((item) => ({
      defense: item.system.defense,
      label: game.i18n.localize(
        item.system.coverage
          ? "EMOKLORE.ApplyDamage.ArmorPieceWithCoverage"
          : "EMOKLORE.ApplyDamage.ArmorPiece",
        { name: item.name, defense: item.system.defense, coverage: item.system.coverage },
      ),
    }));
}

function readInput(button: HTMLElement): DamageReductionInput {
  const form = (button as HTMLButtonElement).form as HTMLFormElement;
  const reduction = (form.elements.namedItem("reduction") as HTMLInputElement).valueAsNumber;

  // callback が null/undefined を返すと本体が "ok" 文字列にすり替える
  // （create-skill-dialog.ts と同じ罠）。必ずオブジェクトを返し、未入力は0に倒す
  const input: DamageReductionInput = { reduction: normalizeReduction(reduction) };

  // 防具のチェックが1つでも外れていたら、チェック済みの合計で上書きする。
  // 全チェックのままなら送らず、既定の「装備合計を自動で」に任せる
  // （ActiveEffect で system.armor を修正している場合と食い違わせないため）
  const boxes = form.elements.namedItem("armorPiece");
  const pieces =
    boxes instanceof RadioNodeList
      ? ([...boxes] as HTMLInputElement[])
      : boxes instanceof HTMLInputElement
        ? [boxes]
        : [];
  if (pieces.length > 0 && pieces.some((box) => !box.checked)) {
    input.armor = pieces.reduce((sum, box) => (box.checked ? sum + Number(box.value) : sum), 0);
  }

  return input;
}
