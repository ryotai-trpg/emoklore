import type { EmokloreActor } from "../documents/actor";

/**
 * Interface for the character sheet JSON format from emoklore.charasheet.jp
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
 * Mapping from Japanese characteristic labels to system keys
 */
const CHARACTERISTIC_MAP: Record<string, string> = {
  身体: "physical",
  器用: "dexterity",
  精神: "mentality",
  五感: "sensitivity",
  知力: "intelligence",
  魅力: "charisma",
  社会: "sociality",
  運勢: "fortune",
};

/**
 * Mapping from Japanese skill labels (including markers) to system keys
 */
const SKILL_MAP: Record<string, string> = {
  検索: "search",
  洞察: "insight",
  マッピング: "mapping",
  直感: "instinct",
  鑑定: "appraisal",
  観察眼: "keenObservation",
  聞き耳: "listen",
  毒味: "taste",
  危機察知: "threatDetection",
  霊感: "spiritualSense",
  社交術: "etiquette",
  ディベート: "debate",
  魅了: "charm",
  心理: "psychology",
  専門知識: "specializedKnowledge",
  事情通: "insider",
  業界: "industryKnowledge",
  スピード: "speed",
  ストレングス: "strength",
  アクロバット: "acrobatics",
  ダイブ: "dive",
  武術: "martialArt",
  奥義: "secretTechnique",
  射撃: "rangedAttack",
  耐久: "endurance",
  根性: "grit",
  医術: "medicine",
  蘇生: "resurrection",
  技巧: "technique",
  芸術: "art",
  操縦: "pilot",
  暗号: "cipher",
  電脳: "computer",
  隠匿: "stealth",
  強運: "strongLuck",
};

/**
 * Mapping from Japanese base skill labels (with ＊ prefix) to system keys
 */
const BASE_SKILL_MAP: Record<string, string> = {
  調査: "investigation",
  知覚: "perception",
  交渉: "negotiations",
  知識: "knowledge",
  ニュース: "news",
  運動: "athletic",
  格闘: "fight",
  投擲: "throw",
  生存: "survival",
  自我: "self",
  手当て: "treatment",
  細工: "handiwork",
  幸運: "luck",
};

/**
 * Mapping from Japanese emotion labels to system keys
 */
const EMOTION_MAP: Record<string, string> = {
  // 欲望 (Desire)
  自己顕示: "selfAssertion",
  所有: "possession",
  本能: "instinct",
  破壊: "destruction",
  優越感: "superiority",
  怠惰: "sloth",
  逃避: "escape",
  好奇心: "curiosity",
  スリル: "thrill",

  // 情念 (Passion)
  喜び: "joy",
  怒り: "anger",
  哀しみ: "sorrow",
  幸福: "happiness",
  不安: "anxiety",
  嫌悪: "disgust",
  恐怖: "fear",
  嫉妬: "jealousy",
  恨み: "grudge",

  // 理想 (Ideal)
  正義: "justice",
  崇拝: "worship",
  善悪: "goodAndEvil",
  希望: "hope",
  向上: "aspiration",
  理性: "reason",
  勝利: "victory",
  秩序: "order",
  憧憬: "admiration",
  無我: "selflessness",

  // 関係 (Relationship)
  友情: "friendship",
  愛: "love",
  恋: "romance",
  依存: "dependence",
  尊敬: "respect",
  軽蔑: "contempt",
  庇護: "protection",
  支配: "domination",
  奉仕: "service",
  甘え: "indulgence",

  // 傷 (Wound)
  後悔: "regret",
  孤独: "loneliness",
  諦観: "resignation",
  絶望: "despair",
  否定: "denial",
  疑念: "doubt",
  罪悪感: "guilt",
  狂気: "madness",
  劣等感: "inferiorityComplex",
};

/**
 * Parse emotions from the memo field
 */
function parseEmotions(memo: string): {
  surface?: string;
  hidden?: string;
  root?: string;
} {
  const emotions: { surface?: string; hidden?: string; root?: string } = {};

  // Match patterns like: 共鳴感情・表: 怒り(情念)
  const surfaceMatch = memo.match(/共鳴感情[・·]表[:：]\s*([^\(（\n]+)/);
  const hiddenMatch = memo.match(/共鳴感情[・·]裏[:：]\s*([^\(（\n]+)/);
  const rootMatch = memo.match(/共鳴感情[・·]ルーツ[:：]\s*([^\(（\n]+)/);

  if (surfaceMatch) {
    const emotionLabel = surfaceMatch[1].trim();
    emotions.surface = EMOTION_MAP[emotionLabel] || emotionLabel;
  }

  if (hiddenMatch) {
    const emotionLabel = hiddenMatch[1].trim();
    emotions.hidden = EMOTION_MAP[emotionLabel] || emotionLabel;
  }

  if (rootMatch) {
    const emotionLabel = rootMatch[1].trim();
    emotions.root = EMOTION_MAP[emotionLabel] || emotionLabel;
  }

  return emotions;
}

/**
 * Parse skills from the commands field
 * Format: "2DM<=4 〈検索〉" or "1DM<=3 〈＊調査〉"
 */
function parseSkills(commands: string): {
  skills: Record<string, number>;
  baseSkills: Record<string, number>;
} {
  const skills: Record<string, number> = {};
  const baseSkills: Record<string, number> = {};

  // Split by newlines and process each command
  const lines = commands.split("\n");

  for (const line of lines) {
    // Match pattern: XDM<=Y 〈[＊★]SkillName〉
    const match = line.match(/(\d+)DM<=\d+\s*[〈<]([＊★]?)([^〉>]+)[〉>]/);
    if (!match) continue;

    const diceCount = parseInt(match[1]);
    const marker = match[2];
    const skillName = match[3].trim();

    // Base skills are marked with ＊
    if (marker === "＊") {
      const baseSkillKey = BASE_SKILL_MAP[skillName];
      if (baseSkillKey) {
        baseSkills[baseSkillKey] = 1; // Base skills are always level 1
      }
    } else {
      // Regular skills - calculate level from dice count
      const skillKey = SKILL_MAP[skillName];
      if (skillKey) {
        // The skill level is typically dice count - 1, but we'll use a mapping based on the pattern
        // This needs to account for characteristic value + skill level
        // For now, store the dice count and we'll calculate later
        skills[skillKey] = diceCount;
      }
    }
  }

  return { skills, baseSkills };
}

/**
 * Calculate skill level from dice count and characteristic value
 * The dice count in the commands represents the skill level directly
 */
function calculateSkillLevel(
  diceCount: number,
  characteristicValue: number,
  skillKey: string,
  skillConfig: typeof CONFIG.EMOKLORE.skills,
): number {
  // The dice count is the skill level itself
  const skillLevel = diceCount;
  // Clamp between 0 and 3
  return Math.max(0, Math.min(3, skillLevel));
}

/**
 * Import character data from the character sheet website JSON
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

  // Import name
  if (data.name) {
    updateData.name = data.name;
  }

  // Import characteristics
  const characteristics: Record<string, number> = {};
  for (const param of data.params) {
    const key = CHARACTERISTIC_MAP[param.label];
    if (key) {
      characteristics[key] = parseInt(param.value);
      updateData[`system.characteristics.${key}.value`] = parseInt(param.value);
    }
  }

  // Import resources (HP, MP, Resonance)
  if (data.status && Array.isArray(data.status)) {
    for (const status of data.status) {
      const label = status.label;
      const value = typeof status.value === "string" ? parseInt(status.value) : status.value;
      const max = typeof status.max === "string" ? parseInt(status.max) : status.max;

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

  // Import emotions from memo
  if (data.memo) {
    const emotions = parseEmotions(data.memo);
    if (emotions.surface) {
      updateData["system.emotions.surface"] = emotions.surface;
    }
    if (emotions.hidden) {
      updateData["system.emotions.hidden"] = emotions.hidden;
    }
    if (emotions.root) {
      updateData["system.emotions.root"] = emotions.root;
    }

    // Store the full memo in biography notes
    updateData["system.biography.note"] = data.memo;
  }

  // Import skills from commands
  if (data.commands) {
    const { skills } = parseSkills(data.commands);

    // For each skill found, calculate the level and set it
    for (const [skillKey, diceCount] of Object.entries(skills)) {
      const skillInfo = CONFIG.EMOKLORE.skills[skillKey as keyof typeof CONFIG.EMOKLORE.skills];
      if (!skillInfo) continue;

      // Get the characteristic this skill uses
      const charKey = skillInfo.characteristicOptions?.[0] || skillInfo.characteristic;
      if (!charKey) continue;

      const charValue = characteristics[charKey] || 1;
      const skillLevel = calculateSkillLevel(
        diceCount,
        charValue,
        skillKey,
        CONFIG.EMOKLORE.skills,
      );

      updateData[`system.skills.${skillKey}.level`] = skillLevel;
    }
  }

  // Store external URL as a flag for reference
  if (data.externalUrl) {
    updateData["flags.emoklore.externalUrl"] = data.externalUrl;
  }

  // Apply all updates to the actor
  await (actor as any).update(updateData);

  (globalThis as any).ui.notifications?.info(
    (globalThis as any).game.i18n.format("EMOKLORE.Import.Success", { name: data.name || (actor as any).name }),
  );
}

/**
 * Validate that the JSON string is valid character sheet data
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
  } catch (error) {
    return { valid: false, error: "EMOKLORE.Import.ErrorInvalidJSON" };
  }
}
