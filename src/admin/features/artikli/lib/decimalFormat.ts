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

  const parts = normalized.includes(';')
    ? normalized.split(';').map((part) => part.trim()).filter(Boolean)
    : [normalized];

  return parts
    .map((token) => parseDecimalInput(token))
    .filter((value): value is number => value !== null);
}
