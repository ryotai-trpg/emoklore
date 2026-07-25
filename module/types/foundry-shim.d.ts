// 本体の global.d.mts に無いレガシーグローバルを補うshim（pf2eの global-external.d.mts と同じ手法）
// 使用しているグローバルだけを宣言する。game / CONFIG / getDocumentClass は本体宣言済みでここには不要
export {};

declare global {
  namespace globalThis {
    export import Hooks = foundry.helpers.Hooks;
    export import Actor = foundry.documents.Actor;
    export import ActiveEffect = foundry.documents.ActiveEffect;
    export import Item = foundry.documents.Item;
    export import ChatMessage = foundry.documents.ChatMessage;
    export import Combat = foundry.documents.Combat;
    export import Combatant = foundry.documents.Combatant;
  }
}
