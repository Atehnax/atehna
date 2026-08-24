import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const checkoutSource = readFileSync(
  resolve(
    process.cwd(),
    'src/commercial/order/components/OrderPageClient.tsx'
  ),
  'utf8'
);

const postalComboboxSource = readFileSync(
  resolve(
    process.cwd(),
    'src/commercial/order/components/PostalLocationCombobox.tsx'
  ),
  'utf8'
);

test('address autocomplete ignores stale successful responses', () => {
  assert.match(
    checkoutSource,
    /controller\.signal\.aborted\s*\|\|\s*addressRequestRef\.current !== controller/u
  );
  assert.match(
    checkoutSource,
    /const payload = [\s\S]+?addressRequestRef\.current !== controller[\s\S]+?setAddressSuggestions\(results\)/u
  );
});

test('address autocomplete starts after the shortened 125 ms debounce', () => {
  assert.match(checkoutSource, /const ADDRESS_SEARCH_DEBOUNCE_MS = 125;/u);
  assert.match(
    checkoutSource,
    /window\.setTimeout\(async \(\) => \{[\s\S]+?\}, ADDRESS_SEARCH_DEBOUNCE_MS\)/u
  );
});

test('address autocomplete ignores stale failures', () => {
  assert.match(
    checkoutSource,
    /catch \(error\) \{[\s\S]+?addressRequestRef\.current !== controller[\s\S]+?setAddressSearchStatus\('error'\)/u
  );
});

test('address selection keeps the canonical structured checkout fields', () => {
  assert.match(checkoutSource, /addressLine1: suggestion\.addressLine1/u);
  assert.match(checkoutSource, /city: suggestion\.postalName/u);
  assert.match(checkoutSource, /postalCode: suggestion\.postalCode/u);
  assert.match(checkoutSource, /gursHouseNumberId: suggestion\.gursHouseNumberId/u);
});

test('postal autocomplete debounces requests and ignores stale responses', () => {
  assert.match(
    postalComboboxSource,
    /window\.setTimeout\(async \(\) => \{[\s\S]+?\}, 250\)/u
  );
  assert.match(
    postalComboboxSource,
    /requestRef\.current\?\.abort\(\)[\s\S]+?controller\.signal\.aborted\s*\|\|\s*requestRef\.current !== controller/u
  );
  assert.match(
    postalComboboxSource,
    /catch \(fetchError\) \{[\s\S]+?requestRef\.current !== controller[\s\S]+?setStatus\('error'\)/u
  );
});

test('postal autocomplete resolves only one exact match', () => {
  assert.match(
    postalComboboxSource,
    /const exactMatches = results\.filter[\s\S]+?if \(exactMatches\.length === 1\)[\s\S]+?onResolve\(exactMatch\)/u
  );
  assert.match(
    postalComboboxSource,
    /setSuggestions\(results\);\s*setIsListOpen\(results\.length > 0\)/u
  );
});

test('postal autocomplete suppresses a reverse lookup after resolution', () => {
  assert.match(
    postalComboboxSource,
    /if \(skipLookupValueRef\.current === value\)[\s\S]+?setIsListOpen\(false\)[\s\S]+?return/u
  );
  assert.match(
    postalComboboxSource,
    /skipLookupValueRef\.current = lookupValue\(field, exactMatch\)/u
  );
});
