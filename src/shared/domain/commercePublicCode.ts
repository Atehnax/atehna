export const COMMERCE_PUBLIC_CODE_ALPHABET =
  '23456789ABCDEFGHJKMNPQRSTVWXYZ';
export const COMMERCE_PUBLIC_CODE_BASE_LENGTH = 16;

const PUBLIC_CODE_BASE_PATTERN = /^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{16}$/u;
const COMPACT_PUBLIC_CODE_PATTERN = /[\s-]+/gu;

export type CommercePublicCodeKind = 'order' | 'quote' | 'offer';

export type ParsedCommercePublicCode = Readonly<{
  kind: CommercePublicCodeKind;
  base: string;
  version: number | null;
}>;

export function isCommercePublicCodeBase(value: unknown): value is string {
  return typeof value === 'string' && PUBLIC_CODE_BASE_PATTERN.test(value);
}

export function requireCommercePublicCodeBase(value: unknown): string {
  if (!isCommercePublicCodeBase(value)) {
    throw new Error('The commerce public-code base is invalid.');
  }
  return value;
}

function groupedBase(base: string): string {
  const normalized = requireCommercePublicCodeBase(base);
  return normalized.match(/.{4}/gu)?.join('-') ?? normalized;
}

export function formatOrderCode(base: string): string {
  return `N-${groupedBase(base)}`;
}

export function formatQuoteCode(base: string): string {
  return `PV-${groupedBase(base)}`;
}

/** Compact display only; never use this value for storage, search, or copying. */
export function abbreviateCommercePublicCode(code: string): string {
  return code.length > 11 ? `${code.slice(0, 6)}\u2026${code.slice(-4)}` : code;
}

export function formatOfferCode(base: string, version: number): string {
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new Error('The offer-code version is invalid.');
  }
  return `PN-${groupedBase(base)}-V${version}`;
}

export function parseCommercePublicCode(
  value: unknown
): ParsedCommercePublicCode | null {
  if (typeof value !== 'string') return null;
  const compact = value
    .trim()
    .toUpperCase()
    .replace(COMPACT_PUBLIC_CODE_PATTERN, '');

  const order = /^N([23456789ABCDEFGHJKMNPQRSTVWXYZ]{16})$/u.exec(compact);
  if (order) return { kind: 'order', base: order[1], version: null };

  const quote = /^PV([23456789ABCDEFGHJKMNPQRSTVWXYZ]{16})$/u.exec(compact);
  if (quote) return { kind: 'quote', base: quote[1], version: null };

  const offer = /^PN([23456789ABCDEFGHJKMNPQRSTVWXYZ]{16})V([1-9]\d*)$/u.exec(
    compact
  );
  if (!offer) return null;
  const version = Number(offer[2]);
  return Number.isSafeInteger(version)
    ? { kind: 'offer', base: offer[1], version }
    : null;
}

export function matchesParsedCommercePublicCode(
  value: unknown,
  expected: ParsedCommercePublicCode
): boolean {
  const parsed = parseCommercePublicCode(value);
  return parsed !== null
    && parsed.kind === expected.kind
    && parsed.base === expected.base
    && parsed.version === expected.version;
}
