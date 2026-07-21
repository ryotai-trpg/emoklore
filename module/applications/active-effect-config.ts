import type { EffectChangeData } from "@common/documents/_types.mjs";
import { systemPath } from "../constants";
import {
  composeModifierKey,
  composeTargetId,
  GLOBAL_TARGET_ID,
  MODIFIER_ASPECTS,
  type ModifierAspect,
  type ModifierCollection,
  parseModifierKey,
  parseTargetId,
} from "../utils/effect-keys";
import { typedEntries } from "../utils/object";

/**
 * 「キーを直接書く」を表す選択肢の値。
 *
 * `system.initiative` のように選択式で扱えないキーもあるので、逃げ道を1つ残す。
 * ここを塞ぐと、すでに載っている有効な効果が編集できなくなる。
 */
const RAW_KEY_TARGET_ID = "__raw";

type Option = { value: string; label: string };
type OptionGroup = { label: string; options: Option[] };

/**
 * 本体の `_renderChange` が受け取る文脈。
 *
 * 本体の型はJSDoc由来で名前を持たないため、同じ形をこちらで書く。`changeType` は
 * 本体が `_renderChange` の中で入れるもので、種別が登録されていないと `undefined`。
 */
type ChangeRenderContext = {
  change: EffectChangeData;
  index: number;
  fields: Record<string, foundry.data.fields.DataField>;
  defaultPriority: number;
  changeTypes: Record<string, string>;
  changeType?: unknown;
};

/** 修正の適用先の選択肢。表ごとに optgroup へ分ける */
const buildTargetGroups = (): OptionGroup[] => {
  const { characteristics, skillGroups, skills, baseSkills } = CONFIG.EMOKLORE;
  const localize = (key: string) => game.i18n.localize(key);

  const toOptions = <K extends string>(
    collection: ModifierCollection,
    table: Record<K, { label: string }>,
    decorate: (key: K, label: string) => string = (_key, label) => label,
  ): Option[] =>
    typedEntries(table).map(([key, { label }]) => ({
      value: composeTargetId({ kind: "collection", collection, key }),
      label: decorate(key, label),
    }));

  return [
    {
      label: localize("EMOKLORE.Effect.TargetGroup.global"),
      options: [
        { value: GLOBAL_TARGET_ID, label: localize("EMOKLORE.Effect.TargetGroup.everyRoll") },
      ],
    },
    {
      label: localize("EMOKLORE.Effect.TargetGroup.characteristics"),
      options: toOptions("characteristics", characteristics),
    },
    {
      label: localize("EMOKLORE.Effect.TargetGroup.skillGroups"),
      options: toOptions("skillGroups", skillGroups),
    },
    {
      // ★ はエクストラ技能の印。シートやチャットの表記と揃える
      label: localize("EMOKLORE.Effect.TargetGroup.skills"),
      options: toOptions("skills", skills, (key, label) =>
        skills[key].isExtra ? `★${label}` : label,
      ),
    },
    {
      // ＊ は基本技能の印。技能グループと綴りが同じキーがあるので、印で見分けが付く
      label: localize("EMOKLORE.Effect.TargetGroup.baseSkills"),
      options: toOptions("baseSkills", baseSkills, (_key, label) => `＊${label}`),
    },
    {
      label: localize("EMOKLORE.Effect.TargetGroup.other"),
      options: [
        { value: RAW_KEY_TARGET_ID, label: localize("EMOKLORE.Effect.TargetGroup.rawKey") },
      ],
    },
  ];
};

/**
 * 効果の設定シート。
 *
 * 本体との違いは変更行だけ。属性キーを手打ちさせるかわりに「対象 × 種類」の2段の
 * 選択で組み立てさせ、あわせて本体が hidden でしか持っていない `phase` を出す。
 *
 * `phase` を出すのが地味に効く。v14 の `final` は `prepareDerivedData` の後に走るので
 * 行動値やHP最大値に効果を乗せられるが、本体のシートからは選べない。
 */
export class EmokloreActiveEffectConfig extends foundry.applications.sheets.ActiveEffectConfig {
  static override DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    // 自前のCSSは .emoklore の下に書いてあるので、印を付けて届くようにする
    classes: [...super.DEFAULT_OPTIONS.classes, "emoklore"],
    // 本体の既定は560px。キーを2列に割ったぶん列が増えるので広げる
    position: { ...super.DEFAULT_OPTIONS.position, width: 720 },
  };

  static override PARTS = {
    ...super.PARTS,
    changes: {
      template: systemPath("templates/apps/effect-changes.hbs"),
      templates: [systemPath("templates/apps/effect-change.hbs")],
      scrollable: ["ol[data-changes]"],
    },
  };

  /**
   * 変更行1つぶんを描く。
   *
   * 前処理（`*Path` の組み立てと、文字列でない効果値の JSON 化）は本体に任せたいので
   * 一度 `super` を通す。戻ってきたHTMLを使うのは、登録されていない種別で本体が
   * 警告を出す場合だけ。
   */
  protected override async _renderChange(context: ChangeRenderContext): Promise<string> {
    const coreRow = await super._renderChange(context);
    if (!context.changeType) return coreRow;

    const key = context.change.key ?? "";
    const parsed = parseModifierKey(key);
    // 「＋」で足したばかりの行はキーが空。読み取れないからといって生入力に倒すと、
    // 行を足すたびに選択式でない画面が出てしまう。未選択として選択式のまま出す
    const isNew = key === "";

    return foundry.applications.handlebars.renderTemplate(
      systemPath("templates/apps/effect-change.hbs"),
      {
        ...context,
        targetGroups: buildTargetGroups(),
        aspects: MODIFIER_ASPECTS.map((aspect) => ({
          value: aspect,
          label: game.i18n.localize(`EMOKLORE.Effect.Aspect.${aspect}`),
        })),
        phases: this.#buildPhaseOptions(),
        // 読み取れないキーは選択式で表せないので、生の入力に倒す。
        // ただし空（新しい行）は「まだ選んでいない」であって「表せない」ではない
        selectedTarget: parsed ? composeTargetId(parsed.target) : isNew ? "" : RAW_KEY_TARGET_ID,
        selectedAspect: parsed?.aspect ?? MODIFIER_ASPECTS[0],
        isRawKey: !parsed && !isNew,
        isNew,
      },
    );
  }

  /**
   * 適用の段階。`initial` は素の値に、`final` は派生値の計算が済んだあとに乗る。
   *
   * 本体は `EFFECT.CHANGES.PHASES.*` の翻訳を持っているが、どちらを選べばよいかは
   * システムごとの事情なので、こちらの言葉で説明を添える。
   */
  #buildPhaseOptions(): Option[] {
    return typedEntries(ActiveEffect.CHANGE_PHASES).map(([value]) => ({
      value,
      label: game.i18n.localize(`EMOKLORE.Effect.Phase.${value}`),
    }));
  }

  override async _onRender(
    context: Record<string, unknown>,
    options: Record<string, unknown>,
  ): Promise<void> {
    await super._onRender(context, options);

    // 2つの選択と生入力から属性キーを組み立てて、送信される hidden に書き戻す。
    // 行ごとに閉じているので、行を足しても消しても他の行に影響しない
    for (const row of this.element.querySelectorAll<HTMLElement>("[data-change-row]")) {
      const sync = () => EmokloreActiveEffectConfig.#syncKey(row);
      for (const control of row.querySelectorAll<HTMLElement>("[data-change-key-part]")) {
        control.addEventListener("change", sync);
      }
      sync();
    }
  }

  /**
   * 行の入力から属性キーを決めて hidden に入れ、生入力の出し入れを切り替える。
   *
   * hidden にだけ `name` を付けてあるので、送信されるのは常に組み立て済みのキー1つ。
   */
  static #syncKey(row: HTMLElement): void {
    const target = row.querySelector<HTMLSelectElement>("[data-change-key-part=target]");
    const aspect = row.querySelector<HTMLSelectElement>("[data-change-key-part=aspect]");
    const raw = row.querySelector<HTMLInputElement>("[data-change-key-part=raw]");
    const key = row.querySelector<HTMLInputElement>("[data-change-key]");
    if (!target || !aspect || !raw || !key) return;

    const isRaw = target.value === RAW_KEY_TARGET_ID;
    raw.hidden = !isRaw;
    aspect.hidden = isRaw;

    if (isRaw) {
      key.value = raw.value;
      return;
    }

    // 未選択のまま。本体は空のキーを持つ変更を適用の対象から外すので、
    // 選ばずに保存しても何も起きない
    if (target.value === "") {
      key.value = "";
      return;
    }

    const parsedTarget = parseTargetId(target.value);
    // 選択肢は自分で作っているので通らないはずだが、通らなければキーを触らない
    if (!parsedTarget) return;

    key.value = composeModifierKey({
      target: parsedTarget,
      aspect: aspect.value as ModifierAspect,
    });
  }
}
