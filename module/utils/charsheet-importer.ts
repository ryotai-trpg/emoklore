import type { EmokloreActor } from "../documents/actor";
import { typedEntries } from "./object";

/**
 * キャラクター保管所（emoklore.charasheet.jp）が出力するJSONの形。
 * CCFOLIA形式でコピーしたものを想定している
 */
interface CharSheetJSON {
  kind: "character";
  data: {
    name: string;
    params: Array<{ label: string; value: string }>;
    status: Array<{ label: string; value: number | string; max: number | string }>;
    initiative?: number;
    memo?: string;
    externalUrl?: string;
    commands?: string;
  };
}

/**
 * 表示名 → キー の逆引き索引。
 *
 * `CONFIG.EMOKLORE` のラベルは `i18nInit` の `performPreLocalization` で翻訳済みの
 * 日本語文字列になっているので、そこから引き直せばベタ書きの対応表は要らない。
 * 技能を足したときに取り込み側の更新を忘れる、という事故を構造的に防ぐ。
 */
export function buildLabelIndex(config: Record<string, { label: string }>): Record<string, string> {
  return Object.fromEntries(Object.entries(config).map(([key, { label }]) => [label, key]));
}

/** 取り込みに使う逆引き索引一式 */
export type ImportIndexes = {
  characteristics: Record<string, string>;
  skills: Record<string, string>;
  baseSkills: Record<string, string>;
  emotions: Record<string, string>;
};

/**
 * `CONFIG.EMOKLORE` から索引を作る。
 *
 * ここだけが CONFIG に触れる。以下の解析関数は索引を引数で受け取るので、
 * Foundryを起動せずに単体テストできる。
 */
export function buildImportIndexes(): ImportIndexes {
  return {
    characteristics: buildLabelIndex(CONFIG.EMOKLORE.characteristics),
    skills: buildLabelIndex(CONFIG.EMOKLORE.skills),
    baseSkills: buildLabelIndex(CONFIG.EMOKLORE.baseSkills),
    emotions: buildLabelIndex(CONFIG.EMOKLORE.resonantEmotions),
  };
}

type ParsedEmotions = {
  emotions: { surface?: string; hidden?: string; root?: string };
  /** 索引に無く、取り込めなかったラベル */
  unrecognized: string[];
};

const EMOTION_PATTERNS = {
  // 例: 共鳴感情・表: 怒り(情念)
  surface: /共鳴感情[・·]表[:：]\s*([^(（\n]+)/,
  hidden: /共鳴感情[・·]裏[:：]\s*([^(（\n]+)/,
  root: /共鳴感情[・·]ルーツ[:：]\s*([^(（\n]+)/,
} as const;

/**
 * memo欄から共鳴感情を取り出す。
 *
 * 正規のシートからのコピーであれば索引に無いラベルは来ないため、
 * 一致しないものは異常入力とみなして取り込まず、呼び出し側で警告する。
 * 生の文字列を保存すると、シートが未解決のi18nキーを表示してしまう。
 */
export function parseEmotions(memo: string, index: Record<string, string>): ParsedEmotions {
  const emotions: ParsedEmotions["emotions"] = {};
  const unrecognized: string[] = [];

  for (const [key, pattern] of typedEntries(EMOTION_PATTERNS)) {
    const label = memo.match(pattern)?.[1]?.trim();
    if (!label) continue;

    const emotionKey = index[label];
    if (emotionKey) {
      emotions[key] = emotionKey;
    } else {
      unrecognized.push(label);
    }
  }

  return { emotions, unrecognized };
}

/**
 * 技能名から特化名を切り出す。
 *
 * 保管所の出力は〈専門知識（デザイン）〉のように括弧で括る。シート側の表示は
 * 〈専門知識：考古学〉とコロン区切りなので、どちらの表記でも拾えるようにしている。
 * 全角・半角も両方受ける。
 */
const SPECIALIZATION_PATTERN = /^(.+?)\s*(?:[（(]\s*(.*?)\s*[）)]|[：:]\s*(.*))$/;

/** 技能レベルの下限・上限。スキーマの skills.*.level と揃える */
const SKILL_LEVEL_MIN = 0;
const SKILL_LEVEL_MAX = 3;

export type ParsedSkills = {
  /** 技能キー → レベル */
  skills: Record<string, number>;
  /** 技能キー → 特化名。特化を持つ技能だけ入る */
  specializations: Record<string, string>;
  /** 基本技能キー → レベル（常に1） */
  baseSkills: Record<string, number>;
  /** 索引に無く、取り込めなかった技能名 */
  unrecognized: string[];
};

/**
 * commands 欄のチャットパレットから技能を読み取る。
 *
 * 「2DM<=4 〈検索〉」「1DM<=3 〈＊調査〉」「3DM<=8 〈専門知識：考古学〉」の形。
 * ＊は基本技能、★はエクストラ技能の目印で、どちらも技能名からは外して引く。
 *
 * ダイス数がそのまま技能レベルになる。判定式が「ダイス数 = 技能レベル + ボーナス」
 * なので、ボーナスの無いチャットパレットではダイス数と技能レベルが一致する
 * （保管所の実データで確認済み。Issue #14）。
 */
export function parseSkills(
  commands: string,
  index: Pick<ImportIndexes, "skills" | "baseSkills">,
): ParsedSkills {
  const skills: Record<string, number> = {};
  const specializations: Record<string, string> = {};
  const baseSkills: Record<string, number> = {};
  const unrecognized: string[] = [];

  for (const line of commands.split("\n")) {
    const match = line.match(/(\d+)DM<=\d+\s*[〈<]([＊★]?)([^〉>]+)[〉>]/);
    if (!match?.[1] || !match[3]) continue;

    const diceCount = Number.parseInt(match[1], 10);
    const marker = match[2];
    const [name, specialization] = splitSpecialization(match[3].trim());

    if (marker === "＊") {
      const key = index.baseSkills[name];
      if (key) {
        baseSkills[key] = 1; // 基本技能のレベルは常に1
      } else {
        unrecognized.push(`＊${name}`);
      }
      continue;
    }

    const key = index.skills[name];
    if (!key) {
      unrecognized.push(name);
      continue;
    }

    skills[key] = Math.max(SKILL_LEVEL_MIN, Math.min(SKILL_LEVEL_MAX, diceCount));
    if (specialization) specializations[key] = specialization;
  }

  return { skills, specializations, baseSkills, unrecognized };
}

/** 〈専門知識（デザイン）〉のような表記を技能名と特化名に分ける */
function splitSpecialization(raw: string): [name: string, specialization?: string | undefined] {
  const match = raw.match(SPECIALIZATION_PATTERN);
  if (!match?.[1]) return [raw];

  // 括弧とコロンのどちらで書かれていても、中身は同じ位置に入る
  return [match[1], (match[2] ?? match[3])?.trim() || undefined];
}

/**
 * 保管所のJSONからアクターへ取り込む
 */
export async function importFromCharSheet(
  actor: EmokloreActor,
  jsonData: CharSheetJSON,
): Promise<void> {
  if (jsonData.kind !== "character") {
    throw new Error("Invalid JSON: kind must be 'character'");
  }

  const { data } = jsonData;
  const updateData: Record<string, unknown> = {};
  const index = buildImportIndexes();

  // 名前
  if (data.name) {
    updateData.name = data.name;
  }

  // 能力値
  for (const param of data.params) {
    const key = index.characteristics[param.label];
    if (key) {
      updateData[`system.characteristics.${key}.value`] = Number.parseInt(param.value, 10);
    }
  }

  // リソース（HP / MP / 共鳴）
  if (data.status && Array.isArray(data.status)) {
    for (const status of data.status) {
      const label = status.label;
      const value =
        typeof status.value === "string" ? Number.parseInt(status.value, 10) : status.value;
      const max = typeof status.max === "string" ? Number.parseInt(status.max, 10) : status.max;

      if (label === "HP") {
        updateData["system.resources.hp.value"] = value;
        updateData["system.resources.hp.max"] = max;
      } else if (label === "MP") {
        updateData["system.resources.mp.value"] = value;
        updateData["system.resources.mp.max"] = max;
      } else if (label === "共鳴") {
        updateData["system.resources.resonance.value"] = value;
        updateData["system.resources.resonance.max"] = max;
      }
    }
  }

  // 共鳴感情はメモ欄から拾う
  const unrecognizedEmotions: string[] = [];
  if (data.memo) {
    const { emotions, unrecognized } = parseEmotions(data.memo, index.emotions);
    for (const [key, value] of Object.entries(emotions)) {
      updateData[`system.emotions.${key}`] = value;
    }
    unrecognizedEmotions.push(...unrecognized);

    // メモ欄はそのまま経歴の備考に入れておく
    updateData["system.biography.note"] = data.memo;
  }

  // 技能はチャットパレットから拾う
  const unrecognizedSkills: string[] = [];
  if (data.commands) {
    const { skills, specializations, unrecognized } = parseSkills(data.commands, index);
    unrecognizedSkills.push(...unrecognized);

    for (const [key, level] of Object.entries(skills)) {
      updateData[`system.skills.${key}.level`] = level;
    }

    // 特化名はスキーマに specialization を持つ技能にだけ入れる
    for (const [key, specialization] of Object.entries(specializations)) {
      const config = CONFIG.EMOKLORE.skills[key as keyof typeof CONFIG.EMOKLORE.skills];
      if (config?.hasSpecialization) {
        updateData[`system.skills.${key}.specialization`] = specialization;
      }
    }
  }

  // 元ページのURLはフラグに残しておく
  if (data.externalUrl) {
    updateData["flags.emoklore.externalUrl"] = data.externalUrl;
  }

  // まとめてアクターへ反映する
  await actor.update(updateData);

  ui.notifications?.info(
    game.i18n.localize("EMOKLORE.Import.Success", {
      name: data.name || actor.name,
    }),
  );

  // 取り込めなかったものは黙って捨てず知らせる（表記ゆれの発見に必要）
  if (unrecognizedEmotions.length > 0) {
    ui.notifications?.warn(
      game.i18n.localize("EMOKLORE.Import.WarnUnknownEmotions", {
        labels: unrecognizedEmotions.join("、"),
      }),
    );
  }

  if (unrecognizedSkills.length > 0) {
    ui.notifications?.warn(
      game.i18n.localize("EMOKLORE.Import.WarnUnknownSkills", {
        labels: unrecognizedSkills.join("、"),
      }),
    );
  }
}

/**
 * 貼り付けられた文字列が保管所のJSONとして妥当かを調べる
 */
export function validateCharSheetJSON(jsonString: string): {
  valid: boolean;
  data?: CharSheetJSON;
  error?: string;
} {
  try {
    const data = JSON.parse(jsonString) as CharSheetJSON;

    if (data.kind !== "character") {
      return { valid: false, error: "EMOKLORE.Import.ErrorInvalidKind" };
    }

    if (!data.data || typeof data.data !== "object") {
      return { valid: false, error: "EMOKLORE.Import.ErrorMissingData" };
    }

    return { valid: true, data };
  } catch (_error) {
    return { valid: false, error: "EMOKLORE.Import.ErrorInvalidJSON" };
  }
}
