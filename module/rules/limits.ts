/**
 * 能力値と技能レベルの取りうる範囲。
 *
 * スキーマのバリデーション（data/）、シートの段入力が何段出すか（applications/）、
 * 取り込んだ値のクランプ（utils/）の3層がこれを見る。別々に書くと片方だけ変えたときに
 * 黙ってずれるので、ここを正にする。
 *
 * data/ ではなく rules/ に置いてあるのは層のimport方向のため。utils/ から data/ は
 * 型のみ参照できる決まりなので（docs/code-design.md の層表）、data/ に置くと
 * 取り込み側が値を引けず、実際 charsheet-importer が同じ値を手で書き写していた。
 */
export const CHARACTERISTIC_MIN = 1;
export const CHARACTERISTIC_MAX = 6;
export const SKILL_LEVEL_MIN = 0;
export const SKILL_LEVEL_MAX = 3;
