export function parseOrderId(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('#')) {
    const numeric = trimmed.slice(1);
    const parsed = Number(numeric);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (trimmed.toUpperCase().startsWith('N-')) {
    const numeric = trimmed.slice(trimmed.indexOf('-') + 1);
    const parsed = Number(numeric);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}
