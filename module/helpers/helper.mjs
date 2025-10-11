export function formatDMPart(base, modifier) {
  if (!modifier) return `${base}`;
  const sign = modifier > 0 ? `+${modifier}` : modifier;
  return `(${base}${sign})`;
}

export function formatSuccess(base, modifier) {
  if (!modifier) return `${base}`;
  const sign = modifier > 0 ? `+${modifier}` : modifier;
  return `${base}${sign}`;
}
