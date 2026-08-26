export type NormalizeHexColorOptions = {
  /** Accept #RGBA and #RRGGBBAA in addition to opaque HEX. */
  allowAlpha?: boolean;
};

/**
 * Normalizes a user-entered HEX color to persisted uppercase HEX.
 * Short HEX, a missing hash, surrounding whitespace, and a pasted 0x prefix
 * are accepted. Alpha remains opt-in so opaque color settings cannot
 * accidentally persist transparency.
 */
export function normalizeHexColor(
  value: string,
  { allowAlpha = false }: NormalizeHexColorOptions = {}
): string | null {
  const trimmed = value.trim();
  const digits = trimmed.startsWith('#')
    ? trimmed.slice(1)
    : /^0x/iu.test(trimmed)
      ? trimmed.slice(2)
      : trimmed;

  if (/^[0-9a-f]{3}$/iu.test(digits)) {
    return `#${digits
      .split('')
      .map((digit) => `${digit}${digit}`)
      .join('')}`.toUpperCase();
  }
  if (/^[0-9a-f]{6}$/iu.test(digits)) return `#${digits.toUpperCase()}`;
  if (allowAlpha && /^[0-9a-f]{4}$/iu.test(digits)) {
    return `#${digits
      .split('')
      .map((digit) => `${digit}${digit}`)
      .join('')}`.toUpperCase();
  }
  if (allowAlpha && /^[0-9a-f]{8}$/iu.test(digits)) {
    return `#${digits.toUpperCase()}`;
  }
  return null;
}

/** Shared compact palette used by Podoba, PDF and other admin editors. */
export const ADMIN_HEX_COLOR_PALETTE = [
  '#000000', '#111827', '#334155', '#64748B', '#CBD5E1', '#FFFFFF',
  '#343229', '#6B5E3E', '#D6B72A', '#FACC15', '#F59E0B', '#EA580C',
  '#DC2626', '#E11D48', '#DB2777', '#9333EA', '#7C3AED', '#4F46E5',
  '#2563EB', '#0284C7', '#0891B2', '#0D9488', '#059669', '#16A34A'
] as const;

export function normalizeHexColorPalette(
  palette: readonly string[],
  options: NormalizeHexColorOptions = {}
) {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const candidate of palette) {
    const color = normalizeHexColor(candidate, options);
    if (!color || seen.has(color)) continue;
    seen.add(color);
    normalized.push(color);
  }
  return normalized;
}
