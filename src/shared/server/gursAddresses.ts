import 'server-only';

import type { Pool, PoolClient } from 'pg';
import {
  GURS_ADDRESS_SEARCH_LIMIT,
  GURS_POSTAL_LOOKUP_LIMIT,
  parseGursAddressSearchQuery,
  parseGursPostalLookupQuery,
  type GursAddress,
  type GursAddressSearchResponse,
  type GursAddressSearchResult,
  type GursPostalLocation,
  type GursPostalLookupResponse
} from '@/shared/domain/address/gursAddress';
import { getPool } from '@/shared/server/db';

type Queryable = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;

type GursAddressRow = {
  gurs_house_number_id: string;
  street_name: string | null;
  settlement_name: string;
  house_number: string;
  house_suffix: string | null;
  postal_code: string;
  postal_name: string;
  municipality_name: string;
  address_line_1: string;
  search_text: string;
  source_updated_at: Date | string | null;
};

type GursAddressSearchRow = Pick<
  GursAddressRow,
  | 'gurs_house_number_id'
  | 'address_line_1'
  | 'postal_code'
  | 'postal_name'
  | 'settlement_name'
  | 'municipality_name'
>;

type GursAddressSourceMetadataRow = {
  active_source_updated_at: Date | string | null;
  active_imported_at: Date | string | null;
  active_record_count: number | string | null;
};

type GursPostalLocationRow = {
  postal_code: string;
  postal_name: string;
};

export type GursAddressSourceMetadata = {
  sourceUpdatedAt: string | null;
  importedAt: string | null;
  recordCount: number;
};

export class GursAddressSearchQueryError extends Error {
  readonly code = 'QUERY_TOO_LONG';

  constructor() {
    super('Iskalni niz za naslov je predolg.');
    this.name = 'GursAddressSearchQueryError';
  }
}

type GursPostalLookupQueryErrorCode =
  | 'INVALID_FIELD'
  | 'INVALID_POSTAL_CODE'
  | 'QUERY_TOO_SHORT'
  | 'QUERY_TOO_LONG';

const POSTAL_LOOKUP_ERROR_MESSAGES: Record<
  GursPostalLookupQueryErrorCode,
  string
> = {
  INVALID_FIELD: 'Polje za iskanje poštnega kraja ni veljavno.',
  INVALID_POSTAL_CODE: 'Poštna številka lahko vsebuje samo številke.',
  QUERY_TOO_SHORT: 'Vnesite vsaj dva znaka.',
  QUERY_TOO_LONG: 'Iskalni niz za poštni kraj je predolg.'
};

export class GursPostalLookupQueryError extends Error {
  constructor(readonly code: GursPostalLookupQueryErrorCode) {
    super(POSTAL_LOOKUP_ERROR_MESSAGES[code]);
    this.name = 'GursPostalLookupQueryError';
  }
}

function toIsoString(value: Date | string | null): string | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function toSearchResult(row: GursAddressSearchRow): GursAddressSearchResult {
  return {
    gursHouseNumberId: String(row.gurs_house_number_id),
    addressLine1: row.address_line_1,
    postalCode: row.postal_code,
    postalName: row.postal_name,
    settlementName: row.settlement_name,
    municipalityName: row.municipality_name
  };
}

function toAddress(row: GursAddressRow): GursAddress {
  return {
    gursHouseNumberId: String(row.gurs_house_number_id),
    streetName: row.street_name,
    settlementName: row.settlement_name,
    houseNumber: row.house_number,
    houseSuffix: row.house_suffix,
    postalCode: row.postal_code,
    postalName: row.postal_name,
    municipalityName: row.municipality_name,
    addressLine1: row.address_line_1,
    searchText: row.search_text,
    sourceUpdatedAt: toIsoString(row.source_updated_at)
  };
}

function toPostalLocation(row: GursPostalLocationRow): GursPostalLocation {
  return {
    postalCode: row.postal_code,
    postalName: row.postal_name
  };
}

export async function getGursAddressSourceMetadata(
  queryable?: Queryable
): Promise<GursAddressSourceMetadata> {
  const database = queryable ?? await getPool();
  const result = await database.query<GursAddressSourceMetadataRow>(
    `select active_source_updated_at,
            active_imported_at,
            active_record_count
     from gurs_address_sync_state
     where key = 'active'
     limit 1`
  );
  const row = result.rows[0];
  if (!row) {
    return { sourceUpdatedAt: null, importedAt: null, recordCount: 0 };
  }

  const recordCount = Number(row.active_record_count ?? 0);
  return {
    sourceUpdatedAt: toIsoString(row.active_source_updated_at),
    importedAt: toIsoString(row.active_imported_at),
    recordCount: Number.isSafeInteger(recordCount) && recordCount >= 0
      ? recordCount
      : 0
  };
}

export async function getGursAddressById(
  rawId: unknown,
  queryable?: Queryable
): Promise<GursAddress | null> {
  const gursHouseNumberId =
    typeof rawId === 'string' ? rawId.trim() : String(rawId ?? '').trim();
  if (!gursHouseNumberId || gursHouseNumberId.length > 128) return null;

  const database = queryable ?? await getPool();
  const result = await database.query<GursAddressRow>(
    `select gurs_house_number_id,
            street_name,
            settlement_name,
            house_number,
            house_suffix,
            postal_code,
            postal_name,
            municipality_name,
            address_line_1,
            search_text,
            source_updated_at
     from gurs_addresses
     where gurs_house_number_id = $1
     limit 1`,
    [gursHouseNumberId]
  );

  return result.rows[0] ? toAddress(result.rows[0]) : null;
}

export async function searchGursAddresses(
  rawQuery: unknown,
  queryable?: Queryable
): Promise<GursAddressSearchResponse> {
  const parsed = parseGursAddressSearchQuery(rawQuery);
  if (!parsed.ok) {
    if (parsed.code === 'QUERY_TOO_LONG') {
      throw new GursAddressSearchQueryError();
    }
    // This intentionally avoids opening a database connection while the user
    // has not yet typed enough characters for a useful search.
    return { results: [], sourceUpdatedAt: null };
  }

  const database = queryable ?? await getPool();
  const tokenPatterns = parsed.query
    .split(' ')
    .filter(Boolean)
    .slice(0, 8)
    .flatMap((token) => {
      if (token.length >= 3) return [token];
      if (/^\d{2}$/.test(token)) return [` ${token}`];
      return [];
    });
  if (tokenPatterns.length === 0) {
    return { results: [], sourceUpdatedAt: null };
  }
  const tokenPredicates = tokenPatterns.map(
    (_, index) => `search_text like '%' || $${index + 2} || '%'`
  );
  const tokenMatch = tokenPredicates.length > 0
    ? `(${tokenPredicates.join(' and ')})`
    : 'false';
  const result = await database.query<GursAddressSearchRow>(
    `select gurs_house_number_id,
            address_line_1,
            postal_code,
            postal_name,
            settlement_name,
            municipality_name
     from gurs_addresses
     where search_text like '%' || $1 || '%'
        or ${tokenMatch}
        or $1 <% search_text
     order by
       case
         when search_text = $1 then 0
         when search_text like $1 || '%' then 1
         when search_text like '%' || $1 || '%' then 2
         when ${tokenMatch} then 3
         else 4
       end,
       word_similarity($1, search_text) desc,
       address_line_1 asc,
       postal_code asc,
       gurs_house_number_id asc
     limit ${GURS_ADDRESS_SEARCH_LIMIT}`,
    [parsed.query, ...tokenPatterns]
  );
  const metadata = await getGursAddressSourceMetadata(database);

  return {
    results: result.rows.map(toSearchResult),
    sourceUpdatedAt: metadata.sourceUpdatedAt
  };
}

export async function lookupGursPostalLocations(
  rawField: unknown,
  rawQuery: unknown,
  queryable?: Queryable
): Promise<GursPostalLookupResponse> {
  const parsed = parseGursPostalLookupQuery(rawField, rawQuery);
  if (!parsed.ok) {
    throw new GursPostalLookupQueryError(parsed.code);
  }

  const database = queryable ?? await getPool();
  const normalizedPostalName =
    "regexp_replace(translate(lower(postal_name), 'čšž', 'csz'), '[^a-z0-9]+', ' ', 'g')";
  const fieldExpression = parsed.field === 'postalCode'
    ? 'postal_code'
    : normalizedPostalName;
  const result = await database.query<GursPostalLocationRow>(
    `select postal_code,
            postal_name
     from gurs_addresses
     where search_text like '% ' || $1 || '%'
       and ${fieldExpression} like $1 || '%'
     group by postal_code, postal_name
     order by
       case when ${fieldExpression} = $1 then 0 else 1 end,
       postal_code asc,
       postal_name asc
     limit ${GURS_POSTAL_LOOKUP_LIMIT}`,
    [parsed.query]
  );
  const metadata = await getGursAddressSourceMetadata(database);

  return {
    results: result.rows.map(toPostalLocation),
    sourceUpdatedAt: metadata.sourceUpdatedAt
  };
}
