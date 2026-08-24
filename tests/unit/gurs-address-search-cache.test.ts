import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getAddressSearchCacheControl,
  PUBLIC_ADDRESS_SEARCH_CACHE_CONTROL
} from '@/commercial/api/addresses/search/cachePolicy';

test('does not cache successful search responses before an active dataset exists', () => {
  assert.equal(
    getAddressSearchCacheControl({ sourceUpdatedAt: null }),
    'no-store'
  );
});

test('uses the shared public cache after a canonical dataset is active', () => {
  assert.equal(
    getAddressSearchCacheControl({
      sourceUpdatedAt: '2026-08-17T15:42:43.000Z'
    }),
    PUBLIC_ADDRESS_SEARCH_CACHE_CONTROL
  );
});
