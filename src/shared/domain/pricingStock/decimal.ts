import { pricingStockIssue } from './types';

/**
 * Exact rational arithmetic. Decimal inputs are integers divided by powers of ten;
 * no binary floating point or intermediate rounding enters a calculation.
 * Rounding is half away from zero, only at an explicit decimal output boundary.
 * The bounded numerator/denominator prevents adversarial expressions from growing
 * arbitrary precision integers without limit.
 */
export type ExactDecimal = Readonly<{ numerator: bigint; denominator: bigint }>;
const MAX_COMPONENT = 1n << 1024n;
const MAX_MAGNITUDE = 10n ** 24n;
export const EXACT_ZERO: ExactDecimal = Object.freeze({ numerator: 0n, denominator: 1n });
export const EXACT_ONE: ExactDecimal = Object.freeze({ numerator: 1n, denominator: 1n });

function absolute(value: bigint): bigint { return value < 0n ? -value : value; }
function gcd(left: bigint, right: bigint): bigint {
  let a = absolute(left);
  let b = absolute(right);
  while (b !== 0n) { const next = a % b; a = b; b = next; }
  return a;
}

export function exactDecimal(numerator: bigint, denominator = 1n): ExactDecimal {
  if (denominator === 0n) {
    throw pricingStockIssue('formula', 'DIVISION_BY_ZERO', 'Deljenje z nič ni dovoljeno.');
  }
  if (absolute(numerator) > MAX_COMPONENT * MAX_COMPONENT
    || absolute(denominator) > MAX_COMPONENT * MAX_COMPONENT) {
    throw pricingStockIssue('formula', 'EXPRESSION_LIMIT', 'Izraz presega dovoljeno računsko zahtevnost.');
  }
  const divisor = gcd(numerator, denominator);
  const sign = denominator < 0n ? -1n : 1n;
  const n = (numerator / divisor) * sign;
  const d = (denominator / divisor) * sign;
  if (absolute(n) > MAX_COMPONENT || d > MAX_COMPONENT) {
    throw pricingStockIssue('formula', 'EXPRESSION_LIMIT', 'Izraz presega dovoljeno računsko zahtevnost.');
  }
  if (absolute(n) > MAX_MAGNITUDE * d) {
    throw pricingStockIssue('formula', 'OUT_OF_RANGE', 'Rezultat presega dovoljeno velikost.');
  }
  return n === 0n ? EXACT_ZERO : { numerator: n, denominator: d };
}

export function parseExactDecimal(value: string, field = 'value'): ExactDecimal {
  if (typeof value !== 'string' || value.length > 80) {
    throw pricingStockIssue(field, 'INVALID_DECIMAL', 'Vnesite veljavno decimalno število.');
  }
  const normalized = value.trim();
  const match = /^([+-]?)(\d+)(?:[.,](\d+))?$/u.exec(normalized);
  if (!match || (match[3]?.length ?? 0) > 12 || match[2].length > 25) {
    throw pricingStockIssue(field, 'INVALID_DECIMAL', 'Vnesite število brez ločil tisočic, z največ 12 decimalkami.');
  }
  const fraction = match[3] ?? '';
  return exactDecimal(
    (match[1] === '-' ? -1n : 1n) * BigInt(match[2] + fraction),
    10n ** BigInt(fraction.length)
  );
}

export function addExact(left: ExactDecimal, right: ExactDecimal): ExactDecimal {
  const divisor = gcd(left.denominator, right.denominator);
  return exactDecimal(
    left.numerator * (right.denominator / divisor) + right.numerator * (left.denominator / divisor),
    (left.denominator / divisor) * right.denominator
  );
}
export function negateExact(value: ExactDecimal): ExactDecimal {
  return { numerator: -value.numerator, denominator: value.denominator };
}
export function subtractExact(left: ExactDecimal, right: ExactDecimal): ExactDecimal {
  return addExact(left, negateExact(right));
}
export function multiplyExact(left: ExactDecimal, right: ExactDecimal): ExactDecimal {
  const first = gcd(left.numerator, right.denominator);
  const second = gcd(right.numerator, left.denominator);
  return exactDecimal(
    (left.numerator / first) * (right.numerator / second),
    (left.denominator / second) * (right.denominator / first)
  );
}
export function divideExact(left: ExactDecimal, right: ExactDecimal): ExactDecimal {
  if (right.numerator === 0n) return exactDecimal(1n, 0n);
  const first = gcd(left.numerator, right.numerator);
  const second = gcd(right.denominator, left.denominator);
  return exactDecimal(
    (left.numerator / first) * (right.denominator / second),
    (left.denominator / second) * (right.numerator / first)
  );
}
export function compareExact(left: ExactDecimal, right: ExactDecimal): -1 | 0 | 1 {
  const difference = left.numerator * right.denominator - right.numerator * left.denominator;
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}

export function roundExact(value: ExactDecimal, digits: number): ExactDecimal {
  if (!Number.isInteger(digits) || digits < 0 || digits > 12) {
    throw pricingStockIssue('formula', 'INVALID_PRECISION', 'Število decimalk mora biti celo število med 0 in 12.');
  }
  const scale = 10n ** BigInt(digits);
  const scaled = absolute(value.numerator) * scale;
  const quotient = scaled / value.denominator;
  const remainder = scaled % value.denominator;
  const rounded = quotient + (remainder * 2n >= value.denominator ? 1n : 0n);
  return exactDecimal(value.numerator < 0n ? -rounded : rounded, scale);
}

export function formatExactDecimal(value: ExactDecimal, digits = 2): string {
  const rounded = roundExact(value, digits);
  const scale = 10n ** BigInt(digits);
  const scaled = (rounded.numerator * scale) / rounded.denominator;
  const magnitude = absolute(scaled);
  const integer = magnitude / scale;
  const sign = scaled < 0n ? '-' : '';
  return digits === 0 ? sign + integer.toString()
    : sign + integer.toString() + '.' + (magnitude % scale).toString().padStart(digits, '0');
}

/** Ascending, with missing values last. Useful for exact calculated column sorts. */
export function comparePricingStockDecimals(left: string | null, right: string | null): -1 | 0 | 1 {
  if (left === null) return right === null ? 0 : 1;
  if (right === null) return -1;
  return compareExact(parseExactDecimal(left), parseExactDecimal(right));
}
