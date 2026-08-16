export const GURS_ADDRESS_SEARCH_MIN_LENGTH = 3;
export const GURS_ADDRESS_SEARCH_MAX_LENGTH = 80;
export const GURS_ADDRESS_SEARCH_LIMIT = 8;

export type GursAddress = {
  gursHouseNumberId: string;
  streetName: string | null;
  settlementName: string;
  houseNumber: string;
  houseSuffix: string | null;
  postalCode: string;
  postalName: string;
  municipalityName: string;
  addressLine1: string;
  searchText: string;
  sourceUpdatedAt: string | null;
};

export type GursAddressSearchResult = Pick<
  GursAddress,
  | 'gursHouseNumberId'
  | 'addressLine1'
  | 'postalCode'
  | 'postalName'
  | 'settlementName'
  | 'municipalityName'
>;

export type GursAddressSearchResponse = {
  results: GursAddressSearchResult[];
  sourceUpdatedAt: string | null;
};

export type GursAddressSourceRow = Record<string, unknown>;

const text = (value: unknown) =>
  typeof value === 'string' ? value.trim() : String(value ?? '').trim();

const nullableText = (value: unknown) => {
  const normalized = text(value);
  return normalized || null;
};

export function normalizeAddressSearchText(
  value: string | Array<string | null | undefined>
): string {
  const source = Array.isArray(value) ? value.filter(Boolean).join(' ') : value;
  return source
    .normalize('NFD')
    .replace(/\p{Mark}+/gu, '')
    .toLocaleLowerCase('sl')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeSourceTimestamp(value: unknown): string | null {
  const candidate = text(value);
  if (!candidate) return null;
  const withTimezone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(candidate)
    ? candidate
    : `${candidate}Z`;
  const date = new Date(withTimezone);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function caseInsensitiveSourceRow(row: GursAddressSourceRow) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key.trim().toUpperCase(), value])
  );
}

export function normalizeGursAddressRow(
  row: GursAddressSourceRow,
  fallbackSourceUpdatedAt?: string | null
): GursAddress {
  const source = caseInsensitiveSourceRow(row);
  const gursHouseNumberId = text(source.EID_HISNA_STEVILKA);
  const streetName = nullableText(source.ULICA_NAZIV);
  const settlementName = text(source.NASELJE_NAZIV);
  const houseNumber = text(source.HS_STEVILKA);
  const houseSuffix = nullableText(source.HS_DODATEK);
  const postalCode = text(source.POSTNI_OKOLIS_SIFRA);
  const postalName = text(source.POSTNI_OKOLIS_NAZIV);
  const municipalityName = text(source.OBCINA_NAZIV);

  if (!gursHouseNumberId) {
    throw new Error('GURS address row is missing EID_HISNA_STEVILKA.');
  }
  if (!settlementName || !houseNumber || !postalCode || !postalName) {
    throw new Error(`GURS address ${gursHouseNumberId} is missing a required address field.`);
  }

  const addressBase = streetName ?? settlementName;
  const addressLine1 = `${addressBase} ${houseNumber}${houseSuffix ?? ''}`;
  const searchText = normalizeAddressSearchText([
    addressLine1,
    settlementName,
    postalCode,
    postalName,
    municipalityName
  ]);

  return {
    gursHouseNumberId,
    streetName,
    settlementName,
    houseNumber,
    houseSuffix,
    postalCode,
    postalName,
    municipalityName,
    addressLine1,
    searchText,
    sourceUpdatedAt:
      normalizeSourceTimestamp(source.DATUM_SYS) ??
      normalizeSourceTimestamp(fallbackSourceUpdatedAt)
  };
}

export function parseGursAddressSearchQuery(value: unknown):
  | { ok: true; query: string }
  | { ok: false; code: 'QUERY_TOO_SHORT' | 'QUERY_TOO_LONG' } {
  const query = normalizeAddressSearchText(text(value));
  if (query.length < GURS_ADDRESS_SEARCH_MIN_LENGTH) {
    return { ok: false, code: 'QUERY_TOO_SHORT' };
  }
  if (query.length > GURS_ADDRESS_SEARCH_MAX_LENGTH) {
    return { ok: false, code: 'QUERY_TOO_LONG' };
  }
  return { ok: true, query };
}

export function isAddressSearchQueryEligible(value: unknown): boolean {
  return parseGursAddressSearchQuery(value).ok;
}

export function formatGursSourceDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('sl-SI', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    timeZone: 'Europe/Ljubljana'
  }).format(date);
}
