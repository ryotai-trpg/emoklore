/**
 * アクターシートが種別を問わず共有するコンテキストの組み立て。
 *
 * ここに置くのは、どのアクター種別でも同じ形になるもの（アイテムの一覧・効果の区分け）
 * だけ。種別ごとの組み立ては `context/character.ts` など各ファイルが持ち、必要な分を
 * ここから呼ぶ。
 */

import type { EmokloreActor } from "../../documents/actor";
import type { EmokloreItem } from "../../documents/item";
import { prepareActiveEffectCategories } from "../../utils/effects";
import { formatDamagePreview, formatRangeLabel } from "../../utils/weapon";
import type { ArmorRow, WeaponRow } from "../types";

/** `sort` はスキーマ由来で本体JSDocの型に出ないため、並べ替えの場面だけ足す */
type SortableItem = EmokloreItem & { sort: number };

/**
 * 所持アイテムを種別で絞り、`sort` の順に並べる。
 *
 * 絞り込みは本体の `itemTypes` に任せる（埋め込みコレクション側でメモ化されている）。
 * 本体は `Record<string, Item[]>` で型付けており実装クラスまでは絞られないので、
 * ここで1回だけ絞る。呼び出し側はさらに型述語を通して `system` を確定させる。
 *
 * **並べ直しは必須。** 本体の `documentsByType` は保存順（＝作成順）で返し `sort` を見ない
 * （`common/abstract/embedded-collection.mjs`）ので、ここを通さないとドラッグの並び替えが
 * `sort` を書くだけで表示に出ない。
 */
export const itemsOfType = (actor: EmokloreActor, type: string): EmokloreItem[] =>
  ((actor.itemTypes[type] ?? []) as SortableItem[]).toSorted((a, b) => a.sort - b.sort);

/**
 * アイテムタブ。
 *
 * 間合いとダメージ式は武器の派生値（参照技能から引いたもの）なので、ここでは表示用に
 * 整えるだけ。読むだけの一覧で、値の編集は武器シートが持つ。同じ `name` の入力を2箇所に
 * 描くとフォームの送信が壊れるため、ここに入力は置かない。
 */
export const buildItemsContext = (
  actor: EmokloreActor,
): { weapons: WeaponRow[]; armors: ArmorRow[] } => ({
  // isWeapon / isArmor は型述語なので、filter を通すと system が絞られる。
  // itemTypes の中身は元からその種別だけなので、実行時のふるまいは変わらない
  weapons: itemsOfType(actor, "weapon")
    .filter((item) => item.isWeapon())
    .map((item) => ({
      // 保存済みの埋め込みドキュメントなので id は必ずある
      id: item.id!,
      name: item.name,
      img: item.img,
      rangeLabel: formatRangeLabel(item.system.rangeType, item.system.range),
      damagePreview: formatDamagePreview(item.system.damageDie, item.system.attackPower),
      equipped: item.system.equipped,
    })),
  armors: itemsOfType(actor, "armor")
    .filter((item) => item.isArmor())
    .map((item) => ({
      id: item.id!,
      name: item.name,
      img: item.img,
      defense: item.system.defense,
      coverage: item.system.coverage,
      equipped: item.system.equipped,
    })),
});

/**
 * 効果タブの区分け。
 *
 * ハウリング由来の効果を除くのは共鳴者だけ。共鳴者の効果タブは反応アイテムそのものを
 * 専用区分に並べるので、同じ反応が2行に分かれて見えないよう効果側を除く。専用区分を
 * 持たないシート（NPC・怪異）では、乗ってしまった効果も隠さずそのまま出す。
 */
export const buildEffectCategories = (
  actor: EmokloreActor,
  { excludeHowlingSources }: { excludeHowlingSources: boolean },
): ReturnType<typeof prepareActiveEffectCategories> =>
  prepareActiveEffectCategories(
    [...actor.allApplicableEffects()].filter(
      (effect) =>
        !excludeHowlingSources || (effect.parent as { type?: string } | null)?.type !== "howling",
    ),
  );
