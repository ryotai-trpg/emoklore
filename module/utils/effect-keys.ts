/**
 * ActiveEffectの属性キーの組み立てと読み取り。
 *
 * 効果タブで扱うキーは `system.<表>.<キー>.mod.<種類>` と、全体修正の
 * `system.mod.<種類>` の2形しかない。シートはこの2形だけを選択式で見せ、
 * それ以外のキー（`system.initiative` など）は生の入力に倒す。
 *
 * `CONFIG` を読まないので単体テストできる。選択肢のラベルを作るのは
 * `CONFIG.EMOKLORE` を持っている applications 側の仕事。
 */

/** 修正の種類。ModifierSet の3値に対応する */
export const MODIFIER_ASPECTS = ["bonus", "target", "success"] as const;
export type ModifierAspect = (typeof MODIFIER_ASPECTS)[number];

/** 修正を持つ表。全体修正だけはどの表にも属さない */
export const MODIFIER_COLLECTIONS = [
  "characteristics",
  "skillGroups",
  "skills",
  "baseSkills",
] as const;
export type ModifierCollection = (typeof MODIFIER_COLLECTIONS)[number];

/**
 * 修正の適用先。
 *
 * 判別可能unionにしてあるので、「全体修正なのにキーを持つ」ような
 * 組み合わせを作れない。
 */
export type ModifierTarget =
  | { kind: "global" }
  | { kind: "collection"; collection: ModifierCollection; key: string };

export type ModifierChangeKey = {
  target: ModifierTarget;
  aspect: ModifierAspect;
};

/** 適用先を選択肢の値ひとつで表すときの文字列。全体は `global` */
export const GLOBAL_TARGET_ID = "global";

const MODIFIER_KEY_PATTERN =
  /^system\.(?:(characteristics|skillGroups|skills|baseSkills)\.([A-Za-z][A-Za-z0-9]*)\.)?mod\.(bonus|target|success)$/;

/** `{ 適用先, 種類 }` から属性キーを組み立てる */
export const composeModifierKey = ({ target, aspect }: ModifierChangeKey): string =>
  target.kind === "global"
    ? `system.mod.${aspect}`
    : `system.${target.collection}.${target.key}.mod.${aspect}`;

/**
 * 属性キーを読み取る。修正のキーでなければ `null`。
 *
 * `null` は失敗ではなく「選択式では扱えないキー」の合図で、シートはこれを見て
 * 生の入力に切り替える。ここで弾いたキーも効果としては有効なので、
 * 編集できなくしてはいけない。
 */
export const parseModifierKey = (key: string): ModifierChangeKey | null => {
  const match = MODIFIER_KEY_PATTERN.exec(key);
  if (!match) return null;

  const [, collection, entryKey, aspect] = match;
  // パターンが捕まえている以上この3つの形は保証されるが、型の上では省略可能なので確かめる
  if (!aspect || !isModifierAspect(aspect)) return null;

  if (!collection) return { target: { kind: "global" }, aspect };
  if (!entryKey || !isModifierCollection(collection)) return null;

  return { target: { kind: "collection", collection, key: entryKey }, aspect };
};

/** 適用先を選択肢の値に直す。`global` か `skills.search` の形 */
export const composeTargetId = (target: ModifierTarget): string =>
  target.kind === "global" ? GLOBAL_TARGET_ID : `${target.collection}.${target.key}`;

/** 選択肢の値から適用先に戻す。表の名前として通らなければ `null` */
export const parseTargetId = (id: string): ModifierTarget | null => {
  if (id === GLOBAL_TARGET_ID) return { kind: "global" };

  const [collection, key] = id.split(".");
  if (!collection || !key || !isModifierCollection(collection)) return null;

  return { kind: "collection", collection, key };
};

const isModifierAspect = (value: string): value is ModifierAspect =>
  (MODIFIER_ASPECTS as readonly string[]).includes(value);

const isModifierCollection = (value: string): value is ModifierCollection =>
  (MODIFIER_COLLECTIONS as readonly string[]).includes(value);
