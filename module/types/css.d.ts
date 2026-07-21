// tsconfig の noUncheckedSideEffectImports が有効なので、CSSのside-effect importには
// 宣言が要る。viteがバンドル時に解決するため、型としては空でよい。
// 他の d.ts と違い `export {}` を置かない — ワイルドカードのambient宣言はscriptでしか
// 書けず、モジュールにすると "*.css" の module augmentation と解釈されて失敗する
declare module "*.css";
