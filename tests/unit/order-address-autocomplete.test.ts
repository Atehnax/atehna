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

const adminPostalComboboxSource = readFileSync(
  resolve(
    process.cwd(),
    'src/admin/components/AdminPostalLocationCombobox.tsx'
  ),
  'utf8'
);

const adminOrderDetailSource = readFileSync(
  resolve(
    process.cwd(),
    'src/admin/features/orders/components/AdminOrderDetailClient.tsx'
  ),
  'utf8'
);

const adminQuoteDetailSource = readFileSync(
  resolve(
    process.cwd(),
    'src/admin/features/quotes/components/AdminQuoteDetailClient.tsx'
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

test('address autocomplete starts on the first character and retains results during follow-up edits', () => {
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
  const refreshSetup = checkoutSource.slice(
    checkoutSource.indexOf(
      'const query = normalizeAddressSearchText(formData.addressLine1)'
    ),
    checkoutSource.indexOf('const search = async () =>', checkoutSource.indexOf(
      'const query = normalizeAddressSearchText(formData.addressLine1)'
    ))
  );
  assert.match(refreshSetup, /setAddressSearchStatus\('loading'\)/u);
  assert.doesNotMatch(refreshSetup, /setAddressSuggestions\(\[\]\)/u);
  assert.doesNotMatch(refreshSetup, /setIsAddressListOpen\(false\)/u);
  assert.match(
    checkoutSource,
    /aria-busy=\{addressSearchStatus === 'loading'\}/u
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

test('postal results and source metadata use one direct-prefix database round trip', () => {
  const postalLookupFunction = gursAddressesServerSource.slice(
    gursAddressesServerSource.indexOf(
      'export async function lookupGursPostalLocations'
    )
  );
  assert.equal(
    postalLookupFunction.match(/database\.query</gu)?.length,
    1
  );
  assert.match(
    postalLookupFunction,
    /database\.query<GursPostalLocationQueryRow>\([\s\S]+?left join gurs_address_sync_state as sync[\s\S]+?left join lateral \([\s\S]+?from gurs_addresses[\s\S]+?\) as matched on true/u
  );
  assert.doesNotMatch(
    postalLookupFunction,
    /getGursAddressSourceMetadata\(database\)/u
  );
  assert.match(
    postalLookupFunction,
    /parsed\.field === 'postalCode'[\s\S]+?'postal_code collate "C"'[\s\S]+?normalizedPostalName[\s\S]+?collate "C"/u
  );
  assert.match(
    postalLookupFunction,
    /where \$\{fieldExpression\} like \$2[\s\S]+?\[parsed\.query, `\$\{parsed\.query\}%`\]/u
  );
  assert.doesNotMatch(postalLookupFunction, /search_text like/u);
});

test('postal code and normalized-name prefix indexes survive schema creation and register swaps', () => {
  assert.match(
    databaseSchemaSource,
    /create index gurs_addresses_postal_code_prefix_idx[\s\S]+?postal_code collate "C"[\s\S]+?postal_name collate "C"/u
  );
  assert.match(
    databaseSchemaSource,
    /create index gurs_addresses_postal_name_prefix_idx[\s\S]+?regexp_replace\([\s\S]+?translate\(lower\(postal_name\), 'čšž', 'csz'\)[\s\S]+?collate "C"[\s\S]+?postal_code collate "C"[\s\S]+?postal_name collate "C"/u
  );
  assert.match(
    gursAddressSyncSource,
    /const postalCodeIndex = [^;]+;[\s\S]+?create index \$\{identifier\(postalCodeIndex\)\}[\s\S]+?postal_code collate "C"[\s\S]+?postal_name collate "C"/u
  );
  assert.match(
    gursAddressSyncSource,
    /const postalNameIndex = [^;]+;[\s\S]+?create index \$\{identifier\(postalNameIndex\)\}[\s\S]+?regexp_replace\([\s\S]+?translate\(lower\(postal_name\), 'čšž', 'csz'\)[\s\S]+?collate "C"[\s\S]+?postal_code collate "C"[\s\S]+?postal_name collate "C"/u
  );
});

test('address autocomplete ignores stale failures', () => {
  assert.match(
    checkoutSource,
    /catch \(error\) \{[\s\S]+?addressRequestRef\.current !== controller[\s\S]+?setAddressSearchStatus\('error'\)/u
  );
});

test('address selection keeps the canonical structured checkout fields', () => {
  assert.match(
    checkoutSource,
    /const selectAddressSuggestion = \(suggestion: GursAddressSearchResult\) => \{\s*postalEditSequenceRef\.current \+= 1/u
  );
  assert.match(checkoutSource, /addressLine1: suggestion\.addressLine1/u);
  assert.match(checkoutSource, /city: suggestion\.postalName/u);
  assert.match(checkoutSource, /postalCode: suggestion\.postalCode/u);
  assert.match(checkoutSource, /gursHouseNumberId: suggestion\.gursHouseNumberId/u);
  for (const detailSource of [adminOrderDetailSource, adminQuoteDetailSource]) {
    assert.match(
      detailSource,
      /onSelect=\{\(suggestion\) => \{\s*postalEditSequenceRef\.current \+= 1;[\s\S]+?gursHouseNumberId: suggestion\.gursHouseNumberId/u
    );
  }
});

test('postal autocomplete keeps results visible, accelerates exact codes, and ignores stale responses', () => {
  assert.match(
    postalComboboxSource,
    /const POSTAL_LOOKUP_FOLLOW_UP_DEBOUNCE_MS = 50/u
  );
  assert.match(
    postalComboboxSource,
    /const startsImmediately =\s*field === 'postalCode' && \/\^\\d\{4\}\$\/u\.test\(query\)/u
  );
  assert.match(
    postalComboboxSource,
    /window\.setTimeout\(\(\) => \{[\s\S]+?void search\(\);[\s\S]+?POSTAL_LOOKUP_FOLLOW_UP_DEBOUNCE_MS/u
  );
  assert.match(
    postalComboboxSource,
    /if \(startsImmediately\) void search\(\);/u
  );
  assert.match(
    postalComboboxSource,
    /requestRef\.current\?\.abort\(\)[\s\S]+?controller\.signal\.aborted\s*\|\|\s*requestRef\.current !== controller/u
  );
  assert.match(
    postalComboboxSource,
    /catch \(fetchError\) \{[\s\S]+?requestRef\.current !== controller[\s\S]+?setStatus\('error'\)/u
  );
  const refreshSetup = postalComboboxSource.slice(
    postalComboboxSource.indexOf('const query = value.trim()'),
    postalComboboxSource.indexOf(
      'const search = async () =>',
      postalComboboxSource.indexOf('const query = value.trim()')
    )
  );
  assert.match(refreshSetup, /setStatus\('loading'\)/u);
  assert.match(refreshSetup, /setActiveIndex\(-1\)/u);
  assert.doesNotMatch(refreshSetup, /setSuggestions\(\[\]\)/u);
  assert.doesNotMatch(refreshSetup, /setIsListOpen\(false\)/u);
  assert.match(postalComboboxSource, /aria-busy=\{status === 'loading'\}/u);
});

test('postal autocomplete resolves only one exact match', () => {
  assert.match(
    postalComboboxSource,
    /const exactMatches = results\.filter[\s\S]+?if \(exactMatches\.length === 1\)[\s\S]+?onResolveRef\.current\(exactMatch\)/u
  );
  assert.match(
    postalComboboxSource,
    /setSuggestions\(results\);\s*setIsListOpen\(isActiveRef\.current && results\.length > 0\)/u
  );
});

test('postal request lifetime follows user edits rather than focus or callback identity', () => {
  assert.match(
    postalComboboxSource,
    /userEditedValueRef\.current = event\.target\.value[\s\S]+?onChange\(event\.target\.value\)/u
  );
  assert.match(
    postalComboboxSource,
    /const wasEditedByUser = userEditedValueRef\.current === value[\s\S]+?!wasEditedByUser/u
  );
  assert.match(
    postalComboboxSource,
    /const onResolveRef = useRef\(onResolve\)[\s\S]+?onResolveRef\.current = onResolve/u
  );
  assert.match(
    postalComboboxSource,
    /onResolveRef\.current\(exactMatch\)[\s\S]+?\}, \[\s*disabled,\s*editSequenceRef,\s*field,\s*lookupEnabled,\s*value\s*\]\)/u
  );
  const blurHandler = postalComboboxSource.slice(
    postalComboboxSource.indexOf('const handleBlur ='),
    postalComboboxSource.indexOf('const statusMessage =')
  );
  assert.match(blurHandler, /isActiveRef\.current = false/u);
  assert.match(blurHandler, /setIsListOpen\(false\)/u);
  assert.doesNotMatch(blurHandler, /requestRef\.current|clearTimeout/u);
});

test('postal code and town share one edit sequence that rejects cross-field stale results', () => {
  for (const source of [postalComboboxSource, adminPostalComboboxSource]) {
    assert.match(source, /editSequenceRef: MutableRefObject<number>/u);
    assert.match(
      source,
      /const editSequence = editSequenceRef\.current;[\s\S]+?if \(editSequenceRef\.current !== editSequence\) \{[\s\S]+?return;[\s\S]+?const results/u
    );

    const crossFieldStaleGuard = source.slice(
      source.indexOf('if (editSequenceRef.current !== editSequence)'),
      source.indexOf(
        'const results =',
        source.indexOf('if (editSequenceRef.current !== editSequence)')
      )
    );
    assert.match(crossFieldStaleGuard, /setSuggestions\(\[\]\)/u);
    assert.match(crossFieldStaleGuard, /setIs(?:List)?Open\(false\)/u);
    assert.match(crossFieldStaleGuard, /setActiveIndex\(-1\)/u);
    assert.match(crossFieldStaleGuard, /setStatus\('idle'\)/u);
    assert.equal(
      source.match(/editSequenceRef\.current \+= 1/gu)?.length,
      2,
      'each postal combobox must advance the shared sequence for typing and explicit selection'
    );
  }

  assert.match(checkoutSource, /const postalEditSequenceRef = useRef\(0\)/u);
  assert.equal(
    checkoutSource.match(
      /editSequenceRef=\{postalEditSequenceRef\}/gu
    )?.length,
    2
  );

  for (const detailSource of [adminOrderDetailSource, adminQuoteDetailSource]) {
    assert.match(
      detailSource,
      /function (?:Order|Quote)AddressEditor[\s\S]+?const postalEditSequenceRef = useRef\(0\)/u
    );
    assert.equal(
      detailSource.match(
        /editSequenceRef=\{postalEditSequenceRef\}/gu
      )?.length,
      2,
      'both linked admin inputs must receive the same edit sequence ref'
    );
  }
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

test('admin address autocomplete mirrors the immediate, retained stale-safe storefront search', () => {
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
  const refreshSetup = adminAddressAutocompleteSource.slice(
    adminAddressAutocompleteSource.indexOf(
      'const query = normalizeAddressSearchText(value)'
    ),
    adminAddressAutocompleteSource.indexOf(
      'const search = async () =>',
      adminAddressAutocompleteSource.indexOf(
        'const query = normalizeAddressSearchText(value)'
      )
    )
  );
  assert.match(refreshSetup, /setStatus\('loading'\)/u);
  assert.doesNotMatch(refreshSetup, /setSuggestions\(\[\]\)/u);
  assert.doesNotMatch(refreshSetup, /setIsOpen\(false\)/u);
  assert.match(
    adminAddressAutocompleteSource,
    /aria-busy=\{status === 'loading'\}/u
  );
  assert.match(adminAddressAutocompleteSource, /\.slice\(0, 8\)/u);
});

test('admin address autocomplete retains results only while loading and clears them on terminal failure', () => {
  const terminalFailure = adminAddressAutocompleteSource.slice(
    adminAddressAutocompleteSource.indexOf('} catch (error) {'),
    adminAddressAutocompleteSource.indexOf(
      '} finally {',
      adminAddressAutocompleteSource.indexOf('} catch (error) {')
    )
  );
  assert.match(
    terminalFailure,
    /setSuggestions\(\[\]\);\s*setIsOpen\(false\);\s*setActiveIndex\(-1\);\s*setStatus\('error'\)/u
  );
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
  assert.match(
    adminAddressAutocompleteSource,
    /testId \+[\s\S]+?showErrorFeedback[\s\S]+?'-error'[\s\S]+?showLoadingFeedback[\s\S]+?'-loading'[\s\S]+?'-empty'/u
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
