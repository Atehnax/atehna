import { expect } from '@playwright/test';
import { describe, test } from 'node:test';
import {
  isAddressSearchQueryEligible,
  isGursPostalLookupQueryEligible,
  normalizeAddressSearchText,
  normalizeGursAddressRow,
  parseGursPostalLookupQuery,
  type GursAddress
} from '@/shared/domain/address/gursAddress';
import {
  syncGursAddresses,
  type GursAddressSyncStore
} from '@/shared/server/gursAddressSync';

function createFakeSyncStore(options: { leaseAcquired?: boolean } = {}) {
  const state = {
    activeIds: ['existing-address-id'],
    discardCalls: 0,
    failCalls: 0,
    insertedAddresses: [] as GursAddress[],
    publishCalls: 0
  };

  const store: GursAddressSyncStore = {
    async acquireLease() {
      return options.leaseAcquired === false
        ? { acquired: false }
        : { acquired: true, runId: 'test-run-1' };
    },
    async prepareStage() {
      state.insertedAddresses = [];
    },
    async insertBatch({ addresses }) {
      state.insertedAddresses.push(...addresses);
    },
    async refreshLease() {},
    async inspectStage() {
      const ids = state.insertedAddresses.map(
        (address) => address.gursHouseNumberId
      );
      return {
        recordCount: ids.length,
        uniqueIdCount: new Set(ids).size,
        missingRequiredCount: 0,
        sourceUpdatedAt: '2026-07-01T00:00:00.000Z'
      };
    },
    async indexStage() {},
    async publishStage() {
      state.publishCalls += 1;
      state.activeIds = state.insertedAddresses.map(
        (address) => address.gursHouseNumberId
      );
    },
    async discardStage() {
      state.discardCalls += 1;
      state.insertedAddresses = [];
    },
    async failSync() {
      state.failCalls += 1;
    }
  };

  return { state, store };
}

const silentSyncLogger = {
  info() {},
  warn() {},
  error() {}
};

function gursCsv(rows: string[] = []) {
  return [
    [
      'FID',
      'EID_HISNA_STEVILKA',
      'ULICA_NAZIV',
      'NASELJE_NAZIV',
      'HS_STEVILKA',
      'HS_DODATEK',
      'POSTNI_OKOLIS_SIFRA',
      'POSTNI_OKOLIS_NAZIV',
      'OBCINA_NAZIV',
      'DATUM_SYS'
    ].join(','),
    ...rows
  ].join('\n');
}

describe('GURS address normalization', () => {
  test('normalizes diacritics, punctuation and repeated spaces for search', () => {
    expect(
      normalizeAddressSearchText(
        '  Žužemberk,  Šolska cesta 11C / 8360 Žužemberk  '
      )
    ).toBe('zuzemberk solska cesta 11c 8360 zuzemberk');
    expect(isAddressSearchQueryEligible(' ž! ')).toBe(false);
    expect(isAddressSearchQueryEligible(' Žu! ')).toBe(false);
    expect(isAddressSearchQueryEligible(' Žuž! ')).toBe(true);
  });

  test('constructs street and rural display addresses with attached suffixes', () => {
    const sourceUpdatedAt = '2026-07-01T00:00:00.000Z';
    const streetAddress = normalizeGursAddressRow({
      EID_HISNA_STEVILKA: '9223372036854775808',
      ULICA_NAZIV: 'Cankarjeva ulica',
      NASELJE_NAZIV: 'Koper',
      HS_STEVILKA: '27',
      HS_DODATEK: 'a',
      POSTNI_OKOLIS_SIFRA: '6000',
      POSTNI_OKOLIS_NAZIV: 'Koper - Capodistria',
      OBCINA_NAZIV: 'Mestna občina Koper',
      DATUM_SYS: sourceUpdatedAt
    });
    const ruralAddress = normalizeGursAddressRow({
      EID_HISNA_STEVILKA: '9223372036854775810',
      ULICA_NAZIV: null,
      NASELJE_NAZIV: 'Dolenja vas pri Črnomlju',
      HS_STEVILKA: '11',
      HS_DODATEK: 'c',
      POSTNI_OKOLIS_SIFRA: '8340',
      POSTNI_OKOLIS_NAZIV: 'Črnomelj',
      OBCINA_NAZIV: 'Črnomelj',
      DATUM_SYS: sourceUpdatedAt
    });

    expect(streetAddress).toMatchObject({
      gursHouseNumberId: '9223372036854775808',
      streetName: 'Cankarjeva ulica',
      settlementName: 'Koper',
      houseNumber: '27',
      houseSuffix: 'a',
      postalCode: '6000',
      postalName: 'Koper - Capodistria',
      municipalityName: 'Mestna občina Koper',
      addressLine1: 'Cankarjeva ulica 27a',
      sourceUpdatedAt
    });
    expect(typeof streetAddress.gursHouseNumberId).toBe('string');
    expect(streetAddress.searchText).toContain('cankarjeva ulica 27a');
    expect(streetAddress.searchText).toContain('6000');
    expect(streetAddress.searchText).toContain('koper capodistria');
    expect(streetAddress.searchText).toContain('mestna obcina koper');

    expect(ruralAddress).toMatchObject({
      gursHouseNumberId: '9223372036854775810',
      streetName: null,
      settlementName: 'Dolenja vas pri Črnomlju',
      houseNumber: '11',
      houseSuffix: 'c',
      postalCode: '8340',
      postalName: 'Črnomelj',
      municipalityName: 'Črnomelj',
      addressLine1: 'Dolenja vas pri Črnomlju 11c',
      sourceUpdatedAt
    });
    expect(ruralAddress.addressLine1).not.toContain('11 c');
    expect(ruralAddress.searchText).toContain('dolenja vas pri crnomlju 11c');
  });
});

describe('GURS postal lookup query contracts', () => {
  test('accepts two to four digits and rejects malformed postal codes', () => {
    expect(parseGursPostalLookupQuery('postalCode', ' 60 ')).toEqual({
      ok: true,
      field: 'postalCode',
      query: '60'
    });
    expect(parseGursPostalLookupQuery('postalCode', '6000')).toEqual({
      ok: true,
      field: 'postalCode',
      query: '6000'
    });
    expect(parseGursPostalLookupQuery('postalCode', '6')).toEqual({
      ok: false,
      code: 'QUERY_TOO_SHORT'
    });
    expect(parseGursPostalLookupQuery('postalCode', '60a0')).toEqual({
      ok: false,
      code: 'INVALID_POSTAL_CODE'
    });
    expect(parseGursPostalLookupQuery('postalCode', '60000')).toEqual({
      ok: false,
      code: 'QUERY_TOO_LONG'
    });
  });

  test('normalizes postal towns diacritic- and punctuation-insensitively', () => {
    expect(
      parseGursPostalLookupQuery('postalName', '  ČRNOMELJ!  ')
    ).toEqual({
      ok: true,
      field: 'postalName',
      query: 'crnomelj'
    });
    expect(isGursPostalLookupQueryEligible('postalName', 'Crnomelj')).toBe(
      true
    );
    expect(isGursPostalLookupQueryEligible('postalName', 'Č!')).toBe(false);
  });

  test('rejects unknown lookup fields rather than widening the query', () => {
    expect(parseGursPostalLookupQuery('municipalityName', 'Ljubljana')).toEqual({
      ok: false,
      code: 'INVALID_FIELD'
    });
  });
});

describe('GURS monthly sync safety', () => {
  test('retains the active addresses when a staged import fails validation', async () => {
    const { state, store } = createFakeSyncStore();
    let pageRequestCount = 0;
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.searchParams.get('resultType') === 'hits') {
        return new Response(
          '<wfs:FeatureCollection numberMatched="1" xmlns:wfs="http://www.opengis.net/wfs/2.0" />',
          { status: 200 }
        );
      }
      pageRequestCount += 1;
      return new Response(
        pageRequestCount === 1
          ? gursCsv([
              [
                'REGISTER_NASLOVOV.1',
                '9223372036854775808',
                'Cankarjeva ulica',
                'Koper',
                '27',
                'a',
                '6000',
                'Koper - Capodistria',
                'Mestna občina Koper',
                '2026-07-01T00:00:00'
              ].join(',')
            ])
          : gursCsv(),
        { status: 200, headers: { 'Content-Type': 'text/csv' } }
      );
    }) as typeof fetch;

    await expect(
      syncGursAddresses({
        store,
        fetchImpl,
        minRecordCount: 2,
        maxRecordCount: 10,
        pageSize: 20_000,
        insertBatchSize: 1,
        now: () => new Date('2026-08-01T02:00:00.000Z'),
        sleep: async () => {},
        logger: silentSyncLogger
      })
    ).rejects.toThrow(/outside the plausible range/i);

    expect(pageRequestCount).toBe(2);
    expect(state.publishCalls).toBe(0);
    expect(state.activeIds).toEqual(['existing-address-id']);
    expect(state.failCalls).toBe(1);
    expect(state.discardCalls).toBeGreaterThanOrEqual(1);
  });

  test('retries a temporary download failure finitely and keeps old data active', async () => {
    const { state, store } = createFakeSyncStore();
    let pageFetchAttempts = 0;
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.searchParams.get('resultType') === 'hits') {
        return new Response(
          '<wfs:FeatureCollection numberMatched="579772" xmlns:wfs="http://www.opengis.net/wfs/2.0" />',
          { status: 200 }
        );
      }
      pageFetchAttempts += 1;
      return new Response('temporary failure', { status: 503 });
    }) as typeof fetch;

    await expect(
      syncGursAddresses({
        store,
        fetchImpl,
        minRecordCount: 1,
        maxRecordCount: 10,
        now: () => new Date('2026-08-01T02:00:00.000Z'),
        sleep: async () => {},
        logger: silentSyncLogger
      })
    ).rejects.toThrow(/HTTP 503/i);

    expect(pageFetchAttempts).toBe(3);
    expect(state.publishCalls).toBe(0);
    expect(state.activeIds).toEqual(['existing-address-id']);
    expect(state.failCalls).toBe(1);
  });

  test('does no download or mutation while another sync owns the lease', async () => {
    const { state, store } = createFakeSyncStore({ leaseAcquired: false });
    let fetchCalls = 0;
    const summary = await syncGursAddresses({
      store,
      fetchImpl: (async () => {
        fetchCalls += 1;
        throw new Error('fetch should not run');
      }) as typeof fetch,
      logger: silentSyncLogger
    });

    expect(summary.status).toBe('skipped');
    expect(fetchCalls).toBe(0);
    expect(state.publishCalls).toBe(0);
    expect(state.activeIds).toEqual(['existing-address-id']);
  });
});
