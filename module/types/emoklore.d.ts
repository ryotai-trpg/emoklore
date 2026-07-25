export {};

// CONFIG は本体 config.mjs のモジュール名前空間なので、モジュール拡張でEMOKLOREを追加する
declare module "@client/config.mjs" {
  export let EMOKLORE: import("../config/index").EmokloreConfig;
}

// 本体の System は api を持たない。`game.system.api` を名乗るためにここで足す
// （`module/api.ts` の init が実体を入れる）
declare module "@client/packages/system.mjs" {
  export default interface System {
    api: import("../api").EmokloreApi;
  }
}
