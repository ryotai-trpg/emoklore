/**
 * 共鳴者シートがテンプレートに渡すデータの組み立て。
 *
 * シート（`applications/character-sheet.ts`）が持つのはパートの配線と操作のハンドラで、
 * 「テンプレートが何を受け取るか」はここが決める。パートごとに1つの関数にしてあり、
 * 戻り値の型を `Pick<CharacterContext, ...>` で縛ってあるので、コンテキストに無いキーを
 * 積もうとすると型チェックで止まる。
 */

import type { CharacterDataModel } from "../../data/character";
import type { EmokloreActor } from "../../documents/actor";
import { CHARACTERISTIC_POINT_MAX, calculateCharPointSum } from "../../rules/character-points";
import { CHARACTERISTIC_MAX, CHARACTERISTIC_MIN } from "../../rules/limits";
import { getSetting } from "../../settings";
import { prepareHowlingRows } from "../../utils/howling";
import { typedEntries } from "../../utils/object";
import { enrichDocumentHTML } from "../../utils/sheet";
import { BIOGRAPHY_PAIRED_COUNT, buildBiographyRows, buildValueSegments } from "../helpers";
import type { CharacterContext, CharacteristicsMap, LabeledField } from "../types";
import { buildEffectCategories, itemsOfType } from "./actor";

/** このシートは type: "character" にしか登録しないので、アクターは共鳴者に絞れる */
type CharacterActor = EmokloreActor & { system: CharacterDataModel };

/**
 * 能力値の表示用データ。
 *
 * アイコンは CONFIG.EMOKLORE 側の定義なので、テンプレートで二重の lookup を
 * 組まずに済むようここで引いておく。
 */
const buildCharacteristics = (actor: CharacterActor): CharacteristicsMap =>
  Object.fromEntries(
    typedEntries(CONFIG.EMOKLORE.characteristics).map(([chc, { fa }]) => {
      const value = actor.system.characteristics[chc].value;
      return [
        chc,
        {
          field: actor.system.schema.getField(["characteristics", chc]),
          value,
          icon: fa,
          name: `system.characteristics.${chc}.value`,
          segments: buildValueSegments(CHARACTERISTIC_MIN, CHARACTERISTIC_MAX, value),
        },
      ];
    }),
  );

/**
 * サイドバー。
 *
 * 能力値はサイドバーのカードにしか出ないので、ここでだけ用意する。パートは同じ
 * コンテキストを共有するため、別のパートが積んだものを拾うとパートの順序への
 * 暗黙の依存になる。
 */
export const buildSidebarContext = (
  actor: CharacterActor,
): Pick<
  CharacterContext,
  "characteristics" | "charPointSum" | "charPointMax" | "sidebarCollapsed"
> => {
  const characteristics = buildCharacteristics(actor);

  return {
    characteristics,
    charPointSum: calculateCharPointSum(characteristics),
    charPointMax: CHARACTERISTIC_POINT_MAX,
    sidebarCollapsed: getSetting("sidebarCollapsed"),
  };
};

/** 経歴タブ。備考だけリッチテキストなので、描く直前に enrich する */
export const buildBiographyContext = async (
  actor: CharacterActor,
): Promise<Pick<CharacterContext, "biographyPairedRows" | "biographyRows">> => {
  const noteHTML = await enrichDocumentHTML(actor, actor.system.biography.note);

  // systemFields の型は DataField 止まりで fields に降りられないため、スキーマから引く。
  // fields の値も label を持つ形に補っておき、キャストを1回で済ませる
  const biography = actor.system.schema.getField([
    "biography",
  ]) as foundry.data.fields.SchemaField & { fields: Record<string, LabeledField> };

  const rows = buildBiographyRows(biography.fields, actor.system.biography, { note: noteHTML });

  return {
    // 先頭の数件は横並びの組にするので、テンプレート側で分けて回せるよう2つに割る
    biographyPairedRows: rows.slice(0, BIOGRAPHY_PAIRED_COUNT),
    biographyRows: rows.slice(BIOGRAPHY_PAIRED_COUNT),
  };
};

/**
 * 効果タブ。
 *
 * ハウリング反応はアイテムそのものを別区分に並べる。反応が持つ効果は一時的／永続的の
 * 区分から除いてあり、**同じ反応が2行に分かれて見えないようにする**。効果を持たない
 * 反応（RPだけのもの）も並ぶのは、それも受けている状態には違いないため。
 */
export const buildEffectsContext = (
  actor: CharacterActor,
): Pick<CharacterContext, "howlings" | "effects"> => ({
  howlings: prepareHowlingRows(
    itemsOfType(actor, "howling")
      .filter((item) => item.isHowling())
      // 埋め込みドキュメントなので id は必ずある（アイテムタブの行と同じ扱い）
      .map((item) => ({ id: item.id!, name: item.name, img: item.img, system: item.system })),
  ),
  effects: buildEffectCategories(actor, { excludeHowlingSources: true }),
});
