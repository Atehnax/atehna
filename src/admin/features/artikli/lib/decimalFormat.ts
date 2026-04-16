export function parseDecimalInput(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

export function formatDecimalForDisplay(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  const normalized = Number(value);
  if (Number.isInteger(normalized)) return `${normalized}`;
  return `${normalized}`.replace('.', ',');
}

export function formatDecimalForSku(value: number | null | undefined): string {
  const display = formatDecimalForDisplay(value);
  if (!display) return '';
  return display.replace(',', 'P');
}

export function parseDecimalListInput(raw: string): number[] {
  const normalized = raw.trim();
  if (!normalized) return [];

  const hasSemicolon = normalized.includes(';');
  const hasSpaceSeparated = /\s+/.test(normalized);
  if (hasSemicolon || hasSpaceSeparated) {
    return normalized
      .split(/[;\s]+/)
      .map((token) => parseDecimalInput(token))
      .filter((value): value is number => value !== null);
  }

  const parts = normalized.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 2 && !normalized.includes('.') && parts[1].length <= 2) {
    const asSingle = parseDecimalInput(normalized);
    if (asSingle !== null) return [asSingle];
  }

  return parts
    .map((token) => parseDecimalInput(token))
    .filter((value): value is number => value !== null);
}
