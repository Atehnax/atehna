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

const gursAddressesServerSource = readFileSync(
  resolve(process.cwd(), 'src/shared/server/gursAddresses.ts'),
  'utf8'
);

const gursAddressSyncSource = readFileSync(
  resolve(process.cwd(), 'src/shared/server/gursAddressSync.ts'),
  'utf8'
);

const databaseSchemaSource = readFileSync(
  resolve(process.cwd(), 'database/schema.sql'),
  'utf8'
);

const adminAddressAutocompleteSource = readFileSync(
  resolve(
    process.cwd(),
    'src/admin/components/AdminAddressAutocompleteInput.tsx'
  ),
  'utf8'
);

const localhostBootstrapSource = readFileSync(
  resolve(process.cwd(), 'scripts/start-localhost.ps1'),
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

test('address autocomplete starts on the first character and only debounces follow-up edits', () => {
  assert.match(
    checkoutSource,
    /const query = normalizeAddressSearchText\(formData\.addressLine1\)/u
  );
  assert.match(checkoutSource, /const startsImmediately = query\.length === 1/u);
  assert.match(checkoutSource, /if \(startsImmediately\) void search\(\);/u);
  assert.match(
    checkoutSource,
    /window\.setTimeout\(\(\) => \{[\s\S]+?void search\(\);[\s\S]+?ADDRESS_SEARCH_FOLLOW_UP_DEBOUNCE_MS/u
  );
  assert.match(
    checkoutSource,
    /const query = normalizeAddressSearchText\(formData\.addressLine1\);\s*setAddressSearchStatus\('loading'\);\s*setAddressSuggestions\(\[\]\)/u
  );
  assert.doesNotMatch(checkoutSource, /onMouseEnter=/u);
  assert.doesNotMatch(checkoutSource, /onPointerMove=/u);
});

test('address results and source metadata use one database round trip', () => {
  assert.match(
    gursAddressesServerSource,
    /database\.query<GursAddressSearchQueryRow>\([\s\S]+?left join gurs_address_sync_state as sync[\s\S]+?left join lateral \([\s\S]+?from gurs_addresses[\s\S]+?\) as matched on true/u
  );
  const searchFunction = gursAddressesServerSource.slice(
    gursAddressesServerSource.indexOf(
      'export async function searchGursAddresses'
    ),
    gursAddressesServerSource.indexOf(
      'export async function lookupGursPostalLocations'
    )
  );
  assert.doesNotMatch(
    searchFunction,
    /getGursAddressSourceMetadata\(database\)/u
  );
});

test('short address queries use the durable ordered prefix index', () => {
  const shortQueryBranch = gursAddressesServerSource.slice(
    gursAddressesServerSource.indexOf('if (usesOrderedPrefixSearch)'),
    gursAddressesServerSource.indexOf('const tokenPredicates')
  );
  assert.match(
    gursAddressesServerSource,
    /const usesOrderedPrefixSearch =\s*parsed\.query\.length < 3 \|\| tokenPatterns\.length === 0/u
  );
  assert.match(shortQueryBranch, /search_text collate "C" like \$1/u);
  assert.match(
    shortQueryBranch,
    /order by[\s\S]+?search_text collate "C" asc[\s\S]+?limit \$\{GURS_ADDRESS_SEARCH_LIMIT\}/u
  );
  assert.doesNotMatch(shortQueryBranch, /word_similarity|<%|like '%' \|\| \$1/u);
  assert.doesNotMatch(
    gursAddressesServerSource,
    /if \(tokenPatterns\.length === 0\) \{\s*return \{ results: \[\]/u
  );
  assert.match(
    databaseSchemaSource,
    /create index gurs_addresses_search_text_prefix_idx[\s\S]+?search_text collate "C"[\s\S]+?address_line_1 collate "C"/u
  );
  assert.match(
    gursAddressSyncSource,
    /const prefixIndex = [^;]+_search_prefix_idx[^;]+;[\s\S]+?create index \$\{identifier\(prefixIndex\)\}[\s\S]+?search_text collate "C"/u
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

test('admin address autocomplete mirrors the immediate stale-safe storefront search', () => {
  assert.match(
    adminAddressAutocompleteSource,
    /const query = normalizeAddressSearchText\(value\)/u
  );
  assert.match(
    adminAddressAutocompleteSource,
    /const startsImmediately = query\.length === 1/u
  );
  assert.match(
    adminAddressAutocompleteSource,
    /if \(startsImmediately\) void search\(\);/u
  );
  assert.match(
    adminAddressAutocompleteSource,
    /requestRef\.current\?\.abort\(\)[\s\S]+?controller\.signal\.aborted \|\| requestRef\.current !== controller/u
  );
  assert.match(
    adminAddressAutocompleteSource,
    /window\.setTimeout\(\(\) => \{[\s\S]+?void search\(\);[\s\S]+?ADDRESS_SEARCH_FOLLOW_UP_DEBOUNCE_MS/u
  );
  assert.match(
    adminAddressAutocompleteSource,
    /const query = normalizeAddressSearchText\(value\);\s*setStatus\('loading'\);\s*setSuggestions\(\[\]\)/u
  );
  assert.match(adminAddressAutocompleteSource, /\.slice\(0, 8\)/u);
});

test('admin address autocomplete is accessible, portal-safe, and pointer-aware', () => {
  assert.match(adminAddressAutocompleteSource, /role="combobox"/u);
  assert.match(adminAddressAutocompleteSource, /aria-autocomplete="list"/u);
  assert.match(adminAddressAutocompleteSource, /role="listbox"/u);
  assert.match(adminAddressAutocompleteSource, /role="status"[\s\S]+?aria-live="polite"/u);
  assert.match(adminAddressAutocompleteSource, /createPortal\([\s\S]+?document\.body/u);
  assert.match(adminAddressAutocompleteSource, /onPointerDown=\{\(event\) => event\.preventDefault\(\)\}/u);
  assert.match(adminAddressAutocompleteSource, /event\.key === 'ArrowDown'/u);
  assert.match(adminAddressAutocompleteSource, /event\.key === 'Enter'/u);
  assert.match(
    adminAddressAutocompleteSource,
    /optionRefs\.current\[activeIndex\]\?\.scrollIntoView\(\{ block: 'nearest' \}\)/u
  );
  assert.ok(
    adminAddressAutocompleteSource.includes(
      "role={showErrorFeedback ? 'alert' : 'status'}"
    )
  );
  assert.ok(
    adminAddressAutocompleteSource.includes(
      "testId + (showErrorFeedback ? '-error' : '-empty')"
    )
  );
  assert.doesNotMatch(adminAddressAutocompleteSource, /onMouseEnter=/u);
  assert.doesNotMatch(adminAddressAutocompleteSource, /onPointerMove=/u);
});

test('localhost bootstrap hydrates the official register without weakening database isolation', () => {
  assert.ok(
    localhostBootstrapSource.includes(
      "$databaseUri.Host.ToLowerInvariant() -notin @('127.0.0.1', 'localhost', '::1')"
    )
  );
  assert.ok(
    localhostBootstrapSource.includes(
      'active_record_count::bigint as record_count'
    )
  );
  assert.ok(
    localhostBootstrapSource.includes(
      'actual.record_count not between 400000 and 800000'
    )
  );
  assert.ok(
    localhostBootstrapSource.includes(
      'actual.record_count <> state.record_count'
    )
  );
  assert.ok(
    localhostBootstrapSource.includes(
      "state.last_success_at < now() - interval '35 days'"
    )
  );
  assert.ok(
    localhostBootstrapSource.includes(
      "$addressRegisterNeedsSync -eq 'true'"
    )
  );
  assert.ok(localhostBootstrapSource.includes('run addresses:sync'));
  assert.ok(
    localhostBootstrapSource.includes(
      'The app will start, but address suggestions may be incomplete.'
    )
  );
});
