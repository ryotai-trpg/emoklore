import { describe, expect, it } from "vitest";
import type { EmotionAttributesConfig } from "../config/emotion-attributes";
import type { ResonantEmotionsConfig } from "../config/resonant-emotions";
import { getEmotionRows } from "./helpers";

// performPreLocalization 済みの CONFIG を模す。label は翻訳済みの文字列になっている
const resonantEmotions: Record<string, ResonantEmotionsConfig> = {
  possession: { label: "独占", attribute: "desire" },
  hope: { label: "希望", attribute: "ideal" },
};

const emotionAttributes: Record<string, EmotionAttributesConfig> = {
  desire: { label: "欲望" },
  ideal: { label: "理想" },
};

const rowsFor = (emotions: Record<string, string | undefined>) =>
  getEmotionRows(emotions, resonantEmotions, emotionAttributes);

describe("getEmotionRows", () => {
  it("感情名と属性名を翻訳済みの文字列で返す", () => {
    const rows = rowsFor({ surface: "possession", hidden: "hope", root: "possession" });

    expect(rows.surface).toEqual({ label: "独占", attribute: "欲望" });
    expect(rows.hidden).toEqual({ label: "希望", attribute: "理想" });
    expect(rows.root).toEqual({ label: "独占", attribute: "欲望" });
  });

  it("未選択の感情は空文字になる", () => {
    const rows = rowsFor({ surface: "possession" });

    expect(rows.hidden).toEqual({ label: "", attribute: "" });
    expect(rows.root).toEqual({ label: "", attribute: "" });
  });

  // 以前は `EMOKLORE.emotionAttributes.` という尻切れの言語キーを組み立てており、
  // それがそのままシートに表示されていた
  it("既知でない感情が保存されていても言語キーを漏らさない", () => {
    const rows = rowsFor({ surface: "unknownEmotion", hidden: "", root: undefined });

    for (const row of [rows.surface, rows.hidden, rows.root]) {
      expect(row).toEqual({ label: "", attribute: "" });
    }
  });

  it("属性の定義が欠けていても感情名だけは返す", () => {
    const rows = getEmotionRows({ surface: "possession" }, resonantEmotions, {});

    expect(rows.surface).toEqual({ label: "独占", attribute: "" });
  });

  it("3つのキーを必ず埋める", () => {
    expect(Object.keys(rowsFor({}))).toEqual(["surface", "hidden", "root"]);
  });
});
