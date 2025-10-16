export const systemID = "emoklore" as const;

/**
 * Translates repository paths to Foundry Data paths.
 */
export const systemPath = (path: string): string => `systems/${systemID}/${path}`;
