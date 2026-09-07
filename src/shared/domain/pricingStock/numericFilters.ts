import { compareExact, parseExactDecimal, type ExactDecimal } from './decimal';

export type NumericRange = { min: string; max: string };
export type NumericFilterKey =
  | 'inventory' | 'purchaseNet' | 'saleNet' | 'rvc' | 'rvcPercent' | 'workMinutes' | 'targetRvc';

type ParsedRange = { min: ExactDecimal | null; max: ExactDecimal | null };
type RangeResult = { range: ParsedRange; error: null } | { range: null; error: string };

export function isNumericRangeActive(range: NumericRange): boolean {
  return range.min.trim() !== '' || range.max.trim() !== '';
}

function parseRange(range: NumericRange): RangeResult {
  const parsed: ParsedRange = { min: null, max: null };
  for (const [key, label] of [['min', 'Od'], ['max', 'Do']] as const) {
    if (range[key].trim() === '') continue;
    try {
      parsed[key] = parseExactDecimal(range[key]);
    } catch {
      return {
        range: null,
        error: `V polje »${label}« vnesite veljavno število brez ločil tisočic, z največ 12 decimalkami.`,
      };
    }
  }
  if (parsed.min !== null && parsed.max !== null && compareExact(parsed.min, parsed.max) > 0) {
    return { range: null, error: 'Vrednost »Od« ne sme biti večja od vrednosti »Do«.' };
  }
  return { range: parsed, error: null };
}

export function validateNumericRange(range: NumericRange): string | null {
  return parseRange(range).error;
}

/** Inclusive exact comparisons; an invalid active range never widens the result set. */
export function matchesNumericRange(
  value: string | number | null | undefined,
  range: NumericRange,
): boolean {
  if (!isNumericRangeActive(range)) return true;
  const parsed = parseRange(range);
  if (parsed.error !== null || value === null || value === undefined) return false;
  if (typeof value === 'number' && !Number.isFinite(value)) return false;
  try {
    const decimal = parseExactDecimal(String(value));
    return (parsed.range.min === null || compareExact(decimal, parsed.range.min) >= 0)
      && (parsed.range.max === null || compareExact(decimal, parsed.range.max) <= 0);
  } catch {
    return false;
  }
}
