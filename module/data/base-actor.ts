import { EmokloreSystemDataModel } from "./system-model";

export class BaseActorDataModel extends EmokloreSystemDataModel {
  static defineSchema(): Record<string, unknown> {
    const schema: Record<string, unknown> = {};
    return schema;
  }
}
