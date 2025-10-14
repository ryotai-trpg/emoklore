export const systemID: string = "emoklore";

/**
 * Translates repository paths to Foundry Data paths.
 */
export const systemPath = (path: string): string => `systems/${systemID}/${path}`;
