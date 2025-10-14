export function formatDMPart(base: number, modifier: number): string {
  if (!modifier) return `${base}`;
  const sign = modifier > 0 ? `+${modifier}` : modifier;
  return `(${base}${sign})`;
}

export function formatSuccess(base: number, modifier: number): string {
  if (!modifier) return `${base}`;
  const sign = modifier > 0 ? `+${modifier}` : modifier;
  return `${base}${sign}`;
}
