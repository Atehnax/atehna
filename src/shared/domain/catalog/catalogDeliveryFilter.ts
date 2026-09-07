import { formatCatalogDeliveryDays } from './catalogDeliveryEstimate';

export type CatalogDeliveryRange = { min: string; max: string };

type DayInterval = { min: number; max: number };
type ParsedRange = { interval: DayInterval | null; error: null } | { interval: null; error: string };

function parseRange(range: CatalogDeliveryRange): ParsedRange {
  const bounds: { min: number | null; max: number | null } = { min: null, max: null };
  for (const [key, label] of [['min', 'Od'], ['max', 'Do']] as const) {
    const input = range[key].trim();
    if (input === '') continue;
    const days = Number(input);
    if (!/^\d+$/.test(input) || !Number.isSafeInteger(days) || days < 0) {
      return { interval: null, error: 'V polje »' + label + '« vnesite celo število dni, enako ali večje od 0.' };
    }
    bounds[key] = days;
  }
  if (bounds.min === null && bounds.max === null) return { interval: null, error: null };
  // A single field means one exact day, regardless of which field was filled.
  const min = bounds.min ?? bounds.max!;
  const max = bounds.max ?? bounds.min!;
  if (min > max) {
    return { interval: null, error: 'Vrednost »Od« ne sme biti večja od vrednosti »Do«.' };
  }
  return { interval: { min, max }, error: null };
}

export function validateCatalogDeliveryRange(range: CatalogDeliveryRange): string | null {
  return parseRange(range).error;
}

/** Match inclusive overlapping day intervals; unknown estimates cannot match an active filter. */
export function matchesCatalogDeliveryRange(
  value: string | null | undefined,
  range: CatalogDeliveryRange,
): boolean {
  const parsed = parseRange(range);
  if (parsed.error !== null) return false;
  if (parsed.interval === null) return true;
  const formatted = formatCatalogDeliveryDays(value);
  if (formatted === null) return false;
  const [from, to = from] = formatted.slice(0, -2).split('–').map(Number);
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to)) return false;
  return from <= parsed.interval.max && to >= parsed.interval.min;
}
