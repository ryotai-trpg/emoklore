export {};

// CONFIG は本体 config.mjs のモジュール名前空間なので、モジュール拡張でEMOKLOREを追加する
declare module "@client/config.mjs" {
  export let EMOKLORE: import("../config/index").EmokloreConfig;
}
