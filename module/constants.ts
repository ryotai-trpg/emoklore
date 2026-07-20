export const systemID = "emoklore" as const;

/**
 * リポジトリ内のパスを、Foundryが解決できる Data 配下のパスに変換する。
 */
export const systemPath = (path: string): string => `systems/${systemID}/${path}`;
