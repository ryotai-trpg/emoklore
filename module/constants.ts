export const SYSTEM_ID = "emoklore" as const;

/**
 * リポジトリ内のパスを、Foundryが解決できる Data 配下のパスに変換する。
 */
export const systemPath = (path: string): string => `systems/${SYSTEM_ID}/${path}`;
