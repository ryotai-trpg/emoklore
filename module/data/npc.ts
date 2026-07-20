import { EmokloreSystemDataModel } from "./system-model";

/**
 * NPCのデータモデル。
 *
 * **未使用に見えるが消さないこと。** `system.json` の documentTypes に npc が無く
 * 作成できないため、emoklore.ts での登録を外してある（登録だけ残すと
 * EmokloreActor#system の型が嘘になるため）。NPCシートを実装する Phase 3 で戻す。
 */

const { NumberField, SchemaField } = foundry.data.fields;

const defineNpcDataModelSchema = () => ({
  wickedness: new SchemaField({
    value: new NumberField({
      required: true,
      integer: true,
      min: 0,
      initial: 5,
    }),
    max: new NumberField({
      required: true,
      integer: true,
      min: 0,
      initial: 100,
    }),
  }),
});

export class NpcDataModel extends EmokloreSystemDataModel {
  declare wickedness: {
    value: number;
    max: number;
  };

  static override defineSchema() {
    return defineNpcDataModelSchema();
  }
}
