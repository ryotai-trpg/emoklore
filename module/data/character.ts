import { normalizeResonance } from "../rules/derived-values";
import { CharacterLikeDataModel, defineResourcesSchema } from "./character-like";

const { HTMLField, SchemaField, StringField } = foundry.data.fields;

// 判定まわりの共有型・関数は CharacterLikeDataModel と同じ場所（character-like.ts）に居る。
// 従来 data/character から import している箇所を壊さないよう、ここから再輸出する
export {
  type CustomSkillEntry,
  resolveSkillRef,
  type SkillRef,
  type SkillRollContext,
} from "./character-like";

/**
 * 共鳴者（PC）のデータモデル。
 *
 * 能力値・技能・派生値・技能判定の一式は `CharacterLikeDataModel` が持つ（人間NPCと共有）。
 * ここに足すのは共鳴者だけの持ち物 — 共鳴値・共鳴感情（表/裏/ルーツ）・経歴。
 */
export class CharacterDataModel extends CharacterLikeDataModel {
  // 共鳴値を足したリソース。hp/mp は基底と同形
  declare resources: {
    hp: { value: number; max: number };
    mp: { value: number; max: number };
    resonance: { value: number; max: number };
  };

  declare emotions: {
    surface?: string;
    hidden?: string;
    root?: string;
  };

  declare biography: {
    age?: string;
    gender?: string;
    occupation?: string;
    hometown?: string;
    appearance?: string;
    personality?: string;
    background?: string;
    importantPeople?: string;
    likesAndDislikes?: string;
    note: string;
  };

  static override defineSchema() {
    return {
      ...super.defineSchema(),
      // 共鳴値（〈∞共鳴〉）を足す。基底の hp/mp だけの resources を差し替える
      resources: defineResourcesSchema({ resonance: true }),

      emotions: new SchemaField({
        surface: new StringField(),
        hidden: new StringField(),
        root: new StringField(),
      }),

      biography: new SchemaField({
        age: new StringField(),
        gender: new StringField(),
        occupation: new StringField(),
        hometown: new StringField(),
        appearance: new StringField(),
        personality: new StringField(),
        background: new StringField(),
        importantPeople: new StringField(),
        likesAndDislikes: new StringField(),
        note: new HTMLField({ required: true, blank: true }),
      }),
    };
  }

  static override LOCALIZATION_PREFIXES = ["EMOKLORE.Actor.character"];

  override prepareDerivedData() {
    super.prepareDerivedData();

    // 共鳴値の下限（1）は共鳴者だけの派生。基底は hp/mp と初速までを見る
    this.resources.resonance.value = normalizeResonance(this.resources.resonance.value);
  }
}
