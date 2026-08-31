import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { formatStructuredOrderAddress } from '../../src/shared/domain/order/orderAddress';
import {
  getAdminQuoteQuickDateRange,
  normalizeAdminQuoteAmountBound,
  normalizeAdminQuoteCustomerTypeFilter,
  normalizeAdminQuoteDateBound,
  normalizeAdminQuoteDateRange,
  normalizeAdminQuoteRequestNumberBound,
  normalizeAdminQuoteRequestNumberRange
} from '../../src/shared/domain/quote/quoteAdminTypes';

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const quoteTablePath =
  'src/admin/features/quotes/components/AdminQuotesTable.tsx';
const quoteOfferCellPath =
  'src/admin/features/quotes/components/AdminQuoteOfferCell.tsx';

test('quote rows follow the order-table number, column, and matching-hover presentation', () => {
  const table = source(quoteTablePath);
  const header = table.slice(
    table.indexOf('<THead'),
    table.indexOf('</THead>')
  );
  const headings = [
    'P/P',
    'Datum',
    'Naročnik',
    'Naslov',
    'Tip',
    'Status',
    'Vrednost',
    'PDF',
    'Uredi'
  ];

  for (let index = 1; index < headings.length; index += 1) {
    assert.ok(
      header.indexOf(headings[index - 1]) < header.indexOf(headings[index]),
      `${headings[index - 1]} must appear before ${headings[index]}`
    );
  }

  assert.match(table, /const formatQuoteRequestNumber/u);
  assert.match(table, /Number\.isSafeInteger\(numeric\) \? `#\$\{numeric\}`/u);
  assert.match(table, /title=\{row\.requestNumber\}/u);
  assert.match(table, /adminTableMatchingValueBaseClassName/u);
  assert.match(table, /adminTableMatchingValueActiveClassName/u);
  assert.match(table, /setMatchingValue\('date'/u);
  assert.match(table, /setMatchingValue\('customer'/u);
  assert.match(table, /setMatchingValue\('address', addressLabel\)/u);
  assert.match(table, /setMatchingValue\('type', customerTypeLabel\)/u);
  assert.match(table, /setMatchingValue\('total'/u);
  assert.match(table, /min-w-\[1275px\]/u);
  assert.match(table, /<col className="w-\[90px\]" \/>/u);
  assert.match(
    table,
    /visibleColumns\.customer \? <col className="w-\[150px\]" \/>/u
  );
  assert.match(table, /visibleColumns\.address \? <col \/>/u);
  assert.match(
    table,
    /visibleColumns\.type \? <col className="w-\[100px\]" \/>/u
  );
  assert.match(table, /\{ key: 'address', label: 'Naslov' \}/u);
  assert.match(table, /\{ key: 'type', label: 'Tip' \}/u);
  assert.match(table, /address: true/u);
  assert.match(table, /type: true/u);
  assert.match(table, /formatStructuredOrderAddress/u);
  assert.match(table, /const addressLabel = formatQuoteTableAddress\(row\)/u);
  assert.match(
    table,
    /data-testid=\{`quote-table-address-\$\{row\.id\}`\}/u
  );
  assert.match(table, /title=\{addressLabel\}/u);
  assert.match(table, /max-w-full truncate whitespace-nowrap/u);
  assert.match(table, /getCustomerTypeLabel\(row\.customerType\)/u);
  assert.match(table, /data-testid=\{`quote-table-type-\$\{row\.id\}`\}/u);
  assert.match(table, /formatSlDate\(row\.createdAt\)/u);
  assert.match(table, /formatSlDateTime\(row\.createdAt\)/u);
  assert.match(table, /data-testid=\{`quote-table-date-\$\{row\.id\}`\}/u);
  assert.match(table, /toDisplayOrderNumber/u);
  assert.match(table, /href=\{`\/admin\/orders\/\$\{row\.resultingOrderId\}`\}/u);
  assert.match(table, /data-testid=\{`quote-linked-order-\$\{row\.id\}`\}/u);
  assert.match(table, /aria-label=\{`Odpri povezano naročilo \$\{linkedOrderNumber\}`\}/u);
  assert.match(
    table,
    /grid h-12 w-full grid-cols-\[minmax\(0,1fr\)_auto_minmax\(0,1fr\)\] items-center whitespace-nowrap/u
  );
  assert.match(table, /data-testid=\{`quote-number-cell-\$\{row\.id\}`\}/u);
  assert.match(table, /col-start-2 row-start-1[^"]*?justify-self-center[^"]*?tabular-nums/u);
  assert.match(table, /col-start-3 row-start-1[^"]*?justify-self-start/u);
  assert.match(table, />[\s\S]*?\(→[\s\S]*?<\/span>/u);
  const linkedOrderPresentation = table.slice(
    table.indexOf('{row.resultingOrderId && linkedOrderNumber ? ('),
    table.indexOf(') : null}', table.indexOf('{row.resultingOrderId && linkedOrderNumber ? ('))
  );
  assert.match(linkedOrderPresentation, /text-\[color:var\(--blue-500\)\]/u);
  assert.match(linkedOrderPresentation, /hover:text-\[color:var\(--blue-600\)\]/u);
  assert.match(linkedOrderPresentation, /text-\[12px\]/u);
  assert.match(linkedOrderPresentation, /underline decoration-\[1px\]/u);
  assert.doesNotMatch(linkedOrderPresentation, /emerald|rounded-full|bg-emerald/u);
  assert.doesNotMatch(header, />Rezultat</u);
  assert.doesNotMatch(table, /\{ key: 'result', label: 'Rezultat' \}/u);
  assert.doesNotMatch(table, /visibleColumns\.result/u);
  assert.doesNotMatch(table, /dateStyle: 'medium'/u);
  assert.doesNotMatch(table, /Zadnja ponudba/u);

  const colgroup = table.slice(
    table.indexOf('<colgroup>'),
    table.indexOf('</colgroup>')
  );
  assert.ok(
    colgroup.indexOf('visibleColumns.customer') <
      colgroup.indexOf('visibleColumns.address') &&
      colgroup.indexOf('visibleColumns.address') <
        colgroup.indexOf('visibleColumns.type'),
    'Naslov col must appear between Naročnik and Tip'
  );

  const body = table.slice(table.indexOf('<TBody>'), table.indexOf('</TBody>'));
  assert.ok(
    body.indexOf('visibleColumns.customer') <
      body.indexOf('visibleColumns.address') &&
      body.indexOf('visibleColumns.address') <
        body.indexOf('visibleColumns.type'),
    'Naslov cells must appear between Naročnik and Tip cells'
  );

  assert.equal(
    formatStructuredOrderAddress({
      addressLine1: ' Testna ulica 1 ',
      postalCode: '1000',
      city: 'Ljubljana'
    }),
    'Testna ulica 1, 1000 Ljubljana'
  );
  assert.equal(
    formatStructuredOrderAddress({ addressLine1: 'Testna ulica 1' }),
    'Testna ulica 1'
  );
  assert.equal(
    formatStructuredOrderAddress({
      postalCode: '1000',
      city: 'Ljubljana'
    }),
    '1000 Ljubljana'
  );
  assert.equal(
    formatStructuredOrderAddress({
      addressLine1: ' ',
      postalCode: null,
      city: undefined
    }),
    ''
  );
  assert.match(table, /\}\) \|\| '—';/u);
});

test('converted quote keeps the primary P/P number aligned and renders a parenthesized order suffix', () => {
  const table = source(quoteTablePath);
  const numberCellStart = table.indexOf(
    'className="grid h-12 w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center whitespace-nowrap"'
  );
  const numberCellEnd = table.indexOf('                    </div>', numberCellStart);

  assert.ok(numberCellStart >= 0 && numberCellEnd > numberCellStart);
  const numberCell = table.slice(numberCellStart, numberCellEnd);
  assert.match(numberCell, /data-testid=\{`quote-request-number-\$\{row\.id\}`\}/u);
  assert.match(numberCell, /col-start-2 row-start-1[^"]*?justify-self-center/u);
  assert.match(numberCell, /\{row\.resultingOrderId && linkedOrderNumber \? \(/u);
  assert.match(numberCell, /col-start-3 row-start-1[^"]*?justify-self-start/u);
  assert.match(
    numberCell,
    /\(→[\s\S]*?data-testid=\{`quote-linked-order-\$\{row\.id\}`\}[\s\S]*?>[\s\S]*?\{linkedOrderNumber\}[\s\S]*?<\/Link>[\s\S]*?>[\s\S]*?\)[\s\S]*?<\/span>/u
  );
  assert.doesNotMatch(numberCell, /justify-center gap-/u);
});
test('quote P/P filter mirrors the order-number range with URL-backed server pagination', () => {
  const table = source(quoteTablePath);
  const ordersPage = source('src/admin/pages/orders/page.tsx');
  const server = source('src/shared/server/quotes.ts');

  assert.match(table, /aria-label="Filtriraj P\/P"/u);
  assert.match(table, /requestFilterButtonRef/u);
  assert.match(table, /openHeaderFilter === 'request'/u);
  assert.match(
    table,
    /getHeaderPopoverStyle\(requestFilterButtonRef\.current, 192\)/u
  );
  assert.match(table, /adminTableCompactPopoverPanelClassName/u);
  assert.match(table, />\s*Nastavi razpon povpraševanj\s*</u);
  assert.match(
    table,
    /<AdminFilterInput[\s\S]*?type="number"[\s\S]*?min=\{0\}[\s\S]*?max=\{999_999\}[\s\S]*?step=\{1\}[\s\S]*?aria-label="Od"/u
  );
  assert.match(
    table,
    /<AdminFilterInput[\s\S]*?type="number"[\s\S]*?min=\{0\}[\s\S]*?max=\{999_999\}[\s\S]*?step=\{1\}[\s\S]*?aria-label="Do"/u
  );
  assert.match(table, /P\/P:\{' '\}/u);
  assert.match(table, /activeRequestNumberRangeLabel/u);
  assert.match(table, />\s*Potrdi\s*</u);
  assert.match(table, />\s*Ponastavi\s*</u);
  assert.match(
    table,
    /updateList\(\{[\s\S]*?minRequestNumber: ''[\s\S]*?maxRequestNumber: ''[\s\S]*?page: 1[\s\S]*?\}\)/u
  );
  assert.match(
    table,
    /params\.set\('quoteMinRequestNumber', normalizedRequestNumberRange\.min\)/u
  );
  assert.match(
    table,
    /params\.set\('quoteMaxRequestNumber', normalizedRequestNumberRange\.max\)/u
  );
  assert.match(
    table,
    /minRequestNumber: updates\.minRequestNumber \?\? minRequestNumber/u
  );
  assert.match(
    table,
    /maxRequestNumber: updates\.maxRequestNumber \?\? maxRequestNumber/u
  );

  assert.match(ordersPage, /quoteMinRequestNumber\?: string \| string\[\]/u);
  assert.match(ordersPage, /quoteMaxRequestNumber\?: string \| string\[\]/u);
  assert.match(
    ordersPage,
    /normalizeAdminQuoteRequestNumberRange\([\s\S]*?searchParams\?\.quoteMinRequestNumber[\s\S]*?searchParams\?\.quoteMaxRequestNumber/u
  );
  assert.match(
    ordersPage,
    /minRequestNumber: minRequestNumber \? Number\(minRequestNumber\) : undefined/u
  );
  assert.match(
    ordersPage,
    /maxRequestNumber: maxRequestNumber \? Number\(maxRequestNumber\) : undefined/u
  );
  assert.match(ordersPage, /minRequestNumber=\{minRequestNumber\}/u);
  assert.match(ordersPage, /maxRequestNumber=\{maxRequestNumber\}/u);

  assert.match(server, /minRequestNumber\?: number/u);
  assert.match(server, /maxRequestNumber\?: number/u);
  assert.match(
    server,
    /const quoteRequestSequenceExpression = 'right\(qr\.request_number, 6\)::integer'/u
  );
  assert.match(
    server,
    /`\$\{quoteRequestSequenceExpression\} >= \$\$\{queryParams\.length\}`/u
  );
  assert.match(
    server,
    /`\$\{quoteRequestSequenceExpression\} <= \$\$\{queryParams\.length\}`/u
  );
  assert.match(
    server,
    /select count\(\*\)::int as count from quote_requests qr where \$\{whereClause\}/u
  );

  assert.equal(normalizeAdminQuoteRequestNumberBound(' 000014 '), '14');
  assert.equal(normalizeAdminQuoteRequestNumberBound('0'), '0');
  assert.equal(normalizeAdminQuoteRequestNumberBound('999999'), '999999');
  for (const invalid of ['-1', '1.5', '1e2', '1000000', 'Infinity', '']) {
    assert.equal(normalizeAdminQuoteRequestNumberBound(invalid), '');
  }
  assert.deepEqual(normalizeAdminQuoteRequestNumberRange('20', '10'), {
    min: '20',
    max: '10'
  });
  assert.deepEqual(normalizeAdminQuoteRequestNumberRange('14', ''), {
    min: '14',
    max: ''
  });
});

test('quote Tip filter mirrors orders with URL-backed server pagination', () => {
  const table = source(quoteTablePath);
  const ordersPage = source('src/admin/pages/orders/page.tsx');
  const server = source('src/shared/server/quotes.ts');

  const filters = [
    ['all', 'Vsi'],
    ['school', 'Šola'],
    ['company', 'Podjetje'],
    ['individual', 'Fiz. oseba']
  ] as const;

  let previousFilterIndex = -1;
  for (const [value, label] of filters) {
    const filterIndex = table.indexOf(
      `{ value: '${value}', label: '${label}' }`
    );
    assert.ok(
      filterIndex > previousFilterIndex,
      `${label} must be present in customer-type order`
    );
    previousFilterIndex = filterIndex;
  }

  assert.match(table, /aria-label="Filtriraj Tip"/u);
  assert.match(
    table,
    /getHeaderPopoverStyle\(typeFilterButtonRef\.current, 144\)/u
  );
  assert.match(
    table,
    /params\.set\('quoteCustomerType', input\.customerType\)/u
  );
  assert.match(
    table,
    /customerType: updates\.customerType \?\? customerType/u
  );
  assert.match(table, /Tip:\{' '\}/u);
  assert.match(table, /activeCustomerTypeLabel/u);
  assert.match(
    table,
    /updateList\(\{ customerType: 'all', page: 1 \}\)/u
  );

  assert.match(ordersPage, /quoteCustomerType\?: string \| string\[\]/u);
  assert.match(
    ordersPage,
    /normalizeAdminQuoteCustomerTypeFilter\([\s\S]*?searchParams\?\.quoteCustomerType/u
  );
  assert.match(ordersPage, /customerType,[\s\S]*?minTotal:/u);
  assert.match(ordersPage, /customerType=\{customerType\}/u);

  assert.match(server, /customerType\?: AdminQuoteCustomerTypeFilter/u);
  assert.match(server, /queryParams\.push\(options\.customerType\)/u);
  assert.ok(
    server.includes('conditions.push(`qr.customer_type = $${queryParams.length}`)')
  );
  assert.match(
    server,
    /select count\(\*\)::int as count from quote_requests qr where \$\{whereClause\}/u
  );

  assert.equal(normalizeAdminQuoteCustomerTypeFilter('school'), 'school');
  assert.equal(normalizeAdminQuoteCustomerTypeFilter('company'), 'company');
  assert.equal(normalizeAdminQuoteCustomerTypeFilter('individual'), 'individual');
  assert.equal(normalizeAdminQuoteCustomerTypeFilter('unexpected'), 'all');
});

test('quote Datum filter mirrors orders with strict URL-backed calendar ranges', () => {
  const table = source(quoteTablePath);
  const ordersPage = source('src/admin/pages/orders/page.tsx');
  const server = source('src/shared/server/quotes.ts');

  assert.match(table, /aria-label="Filtriraj Datum"/u);
  assert.match(table, /dateFilterButtonRef/u);
  assert.match(table, /openHeaderFilter === 'date'/u);
  assert.match(
    table,
    /getHeaderPopoverStyle\(dateFilterButtonRef\.current, 380\)/u
  );
  assert.match(table, /lang="sl-SI"/u);
  assert.match(table, />\s*Nastavi obdobje\s*</u);
  assert.match(table, /<AdminFilterInput[\s\S]*?type="date"[\s\S]*?aria-label="Od"/u);
  assert.match(table, /<AdminFilterInput[\s\S]*?type="date"[\s\S]*?aria-label="Do"/u);
  assert.match(table, /adminTablePopoverPrimaryButtonClassName/u);
  assert.match(table, /adminTablePopoverSecondaryButtonClassName/u);
  assert.match(table, />\s*Potrdi\s*</u);
  assert.match(table, />\s*Ponastavi\s*</u);

  for (const label of [
    'Zadnjih 7 dni',
    'Zadnjih 30 dni',
    'Zadnjih 90 dni',
    'Zadnjih 180 dni',
    'Zadnje leto',
    'Letos'
  ]) {
    assert.match(table, new RegExp(`label: '${label}'`, 'u'));
  }

  assert.match(table, /params\.set\('quoteFrom', normalizedFromDate\)/u);
  assert.match(table, /params\.set\('quoteTo', normalizedToDate\)/u);
  assert.match(table, /fromDate: updates\.fromDate \?\? fromDate/u);
  assert.match(table, /toDate: updates\.toDate \?\? toDate/u);
  assert.match(table, /Datum:\{' '\}/u);
  assert.match(table, /activeDateRangeLabel/u);
  assert.match(table, /updateList\(\{ fromDate: '', toDate: '', page: 1 \}\)/u);
  assert.match(table, /setDraftFromDate\(fromDate\)/u);
  assert.match(table, /setDraftToDate\(toDate\)/u);

  assert.match(ordersPage, /quoteFrom\?: string \| string\[\]/u);
  assert.match(ordersPage, /quoteTo\?: string \| string\[\]/u);
  assert.match(ordersPage, /normalizeAdminQuoteDateRange\(/u);
  assert.match(ordersPage, /fromDate: quoteFrom \|\| undefined/u);
  assert.match(ordersPage, /toDate: quoteTo \|\| undefined/u);
  assert.match(ordersPage, /fromDate=\{quoteFrom\}/u);
  assert.match(ordersPage, /toDate=\{quoteTo\}/u);

  assert.match(server, /fromDate\?: string/u);
  assert.match(server, /toDate\?: string/u);
  assert.match(
    server,
    /qr\.created_at >= \(\$\$\{queryParams\.length\}::date::timestamp AT TIME ZONE 'Europe\/Ljubljana'\)/u
  );
  assert.match(
    server,
    /qr\.created_at < \(\(\$\$\{queryParams\.length\}::date \+ 1\)::timestamp AT TIME ZONE 'Europe\/Ljubljana'\)/u
  );
  assert.match(
    server,
    /select count\(\*\)::int as count from quote_requests qr where \$\{whereClause\}/u
  );
  assert.match(server, /select max\(created_at\) as latest_created_at/u);
  assert.match(server, /latestCreatedAt:/u);

  assert.equal(normalizeAdminQuoteDateBound(' 2026-08-29 '), '2026-08-29');
  assert.equal(normalizeAdminQuoteDateBound('2024-02-29'), '2024-02-29');
  assert.equal(normalizeAdminQuoteDateBound('2026-02-29'), '');
  assert.equal(normalizeAdminQuoteDateBound('2026-02-31'), '');
  assert.equal(normalizeAdminQuoteDateBound('2026-13-01'), '');
  assert.equal(normalizeAdminQuoteDateBound('29.08.2026'), '');
  assert.equal(normalizeAdminQuoteDateBound(''), '');
  assert.deepEqual(
    normalizeAdminQuoteDateRange('2026-08-29', '2026-08-01'),
    { from: '2026-08-01', to: '2026-08-29' }
  );
  assert.deepEqual(getAdminQuoteQuickDateRange('2026-08-29', '7d'), {
    from: '2026-08-23',
    to: '2026-08-29'
  });
  assert.deepEqual(getAdminQuoteQuickDateRange('2026-08-29', '30d'), {
    from: '2026-07-31',
    to: '2026-08-29'
  });
  assert.deepEqual(getAdminQuoteQuickDateRange('2026-08-29', 'ytd'), {
    from: '2026-01-01',
    to: '2026-08-29'
  });
});

test('quote value filter mirrors the order range control with URL-backed server pagination', () => {
  const table = source(quoteTablePath);
  const ordersPage = source('src/admin/pages/orders/page.tsx');
  const server = source('src/shared/server/quotes.ts');

  assert.match(table, /\{ key: 'total', label: 'Vrednost' \}/u);
  assert.match(table, /AdminRangeFilterPanel/u);
  assert.match(table, /QUOTE_NUMERIC_RANGE_PRESETS/u);
  assert.match(table, /aria-label="Filtriraj Vrednost"/u);
  assert.match(table, /title="Nastavi razpon zneskov \(€\)"/u);
  assert.match(table, /min=\{0\}/u);
  assert.match(table, /Vrednost:\{' '\}/u);
  assert.match(table, /activeTotalRangeLabel/u);
  assert.match(table, /params\.set\('quoteMinTotal', normalizedMinTotal\)/u);
  assert.match(table, /params\.set\('quoteMaxTotal', normalizedMaxTotal\)/u);
  assert.match(table, /minTotal: updates\.minTotal \?\? minTotal/u);
  assert.match(table, /maxTotal: updates\.maxTotal \?\? maxTotal/u);
  assert.match(
    table,
    /updateList\(\{ minTotal: '', maxTotal: '', page: 1 \}\)/u
  );

  assert.match(ordersPage, /quoteMinTotal\?: string \| string\[\]/u);
  assert.match(ordersPage, /quoteMaxTotal\?: string \| string\[\]/u);
  assert.match(ordersPage, /minTotal: minTotal \? Number\(minTotal\) : undefined/u);
  assert.match(ordersPage, /maxTotal: maxTotal \? Number\(maxTotal\) : undefined/u);
  assert.match(ordersPage, /minTotal=\{minTotal\}/u);
  assert.match(ordersPage, /maxTotal=\{maxTotal\}/u);

  assert.match(server, /minTotal\?: number/u);
  assert.match(server, /maxTotal\?: number/u);
  assert.match(server, /latestOfferTotalExpression/u);
  assert.ok(
    server.includes('`${latestOfferTotalExpression} >= $${queryParams.length}`')
  );
  assert.ok(
    server.includes('`${latestOfferTotalExpression} <= $${queryParams.length}`')
  );
  assert.match(
    server,
    /select count\(\*\)::int as count from quote_requests qr where \$\{whereClause\}/u
  );

  assert.equal(normalizeAdminQuoteAmountBound(' 8.38 '), '8.38');
  assert.equal(normalizeAdminQuoteAmountBound('0'), '0');
  assert.equal(normalizeAdminQuoteAmountBound('-1'), '');
  assert.equal(normalizeAdminQuoteAmountBound('Infinity'), '');
});

test('quote offer column uses the current-version secure document button workflow', () => {
  const table = source(quoteTablePath);
  const offerCell = source(quoteOfferCellPath);

  assert.match(table, /AdminQuoteOfferCell/u);
  assert.match(table, /\{ key: 'offer', label: 'PDF' \}/u);
  assert.match(table, /offerVersionId=\{row\.latestOfferVersionId\}/u);
  assert.match(table, /offerStatus=\{row\.latestOfferStatus\}/u);
  assert.match(table, /documents=\{row\.downloadableDocuments\}/u);
  assert.match(offerCell, />\s*PONUDBA\s*<\/button>/u);
  assert.doesNotMatch(offerCell, />\s*PON\s*<\/button>/u);
  assert.match(offerCell, /data-generated=\{hasGeneratedDocument \? 'true' : 'false'\}/u);
  assert.match(offerCell, /border-emerald-700\/35 bg-emerald-50 text-emerald-700/u);
  assert.match(offerCell, /border-slate-300 bg-\[color:var\(--ui-neutral-bg\)\]/u);
  assert.match(
    offerCell,
    /documentItem\.documentType === 'offer' &&\s*documentItem\.offerVersionId === offerVersionId/u
  );
  assert.match(
    offerCell,
    /fetch\(\s*`\/api\/admin\/quote-requests\/\$\{quoteRequestId\}\/documents`/u
  );
  assert.match(offerCell, /body: JSON\.stringify\(\{ offerVersionId \}\)/u);
  assert.match(
    offerCell,
    /const handlePrimaryClick = \(\) => \{\s*if \(!hasGeneratedDocument && canGenerate\) \{\s*void generateOfferDocument\(\);\s*return;\s*\}\s*setIsOpen\(\(current\) => !current\);\s*\};/u
  );
  assert.match(offerCell, /onClick=\{handlePrimaryClick\}/u);
  assert.match(offerCell, /aria-busy=\{isGenerating\}/u);
  assert.match(offerCell, /disabled=\{isGenerating\}/u);
  assert.match(offerCell, /const opensMenu = hasGeneratedDocument \|\| !canGenerate;/u);
  assert.match(offerCell, /aria-haspopup=\{opensMenu \? 'menu' : undefined\}/u);
  assert.match(
    offerCell,
    /`\/api\/admin\/quote-requests\/\$\{quoteRequestId\}\/documents\/\$\{documentId\}`/u
  );
  assert.match(offerCell, /Ponudbo najprej izdajte/u);
  assert.match(offerCell, /Odpri povpraševanje/u);
  assert.doesNotMatch(offerCell, /Nova verzija/u);
});

test('quote status filter and row badges use the shared seven-state vocabulary', () => {
  const table = source(quoteTablePath);
  const status = source('src/shared/domain/quote/quoteRequestStatus.ts');
  const server = source('src/shared/server/quotes.ts');
  const ordersPage = source('src/admin/pages/orders/page.tsx');

  const filters = [
    ['all', 'Vse'],
    ['preparation', 'V pripravi'],
    ['received', 'Prejeto'],
    ['issued', 'Izdano'],
    ['ordered', 'Naročeno'],
    ['declined', 'Zavrnjeno'],
    ['expired', 'Poteklo']
  ] as const;

  assert.match(table, /\{ value: 'all', label: 'Vse' \}/u);
  assert.match(table, /QUOTE_REQUEST_VISIBLE_STATUS_OPTIONS/u);
  assert.match(
    table,
    /\.\.\.QUOTE_REQUEST_VISIBLE_STATUS_OPTIONS\.map\(\(\{ value, label \}\) => \(\{/u
  );

  let previousFilterIndex = -1;
  for (const [value, label] of filters.slice(1)) {
    const filterIndex = status.indexOf(`value: '${value}'`);
    assert.ok(
      filterIndex > previousFilterIndex,
      `${label} must be present in lifecycle order`
    );
    assert.ok(
      status.indexOf(`label: '${label}'`, filterIndex) > filterIndex,
      `${label} must label ${value}`
    );
    previousFilterIndex = filterIndex;
  }

  const whitelistStart = ordersPage.indexOf('const QUOTE_STATUS_FILTERS');
  const whitelist = ordersPage.slice(
    whitelistStart,
    ordersPage.indexOf('];', whitelistStart) + 2
  );
  for (const [value] of filters) {
    assert.match(whitelist, new RegExp(`'${value}'`, 'u'));
  }
  assert.doesNotMatch(
    whitelist,
    /'open'|'awaiting_response'|'accepted'/u
  );

  assert.match(table, /getQuoteRequestStatusLabel\(status\)/u);
  assert.match(status, /offer_issued:[\s\S]*?label: 'Izdano'/u);
  assert.match(status, /awaiting_purchase_order_review:[\s\S]*?label: 'Izdano'/u);
  assert.match(status, /accepted:[\s\S]*?label: 'Naročeno'/u);
  assert.match(status, /converted_to_order:[\s\S]*?label: 'Naročeno'/u);
  assert.match(status, /declined:[\s\S]*?label: 'Zavrnjeno'/u);
  assert.match(status, /withdrawn:[\s\S]*?label: 'Zavrnjeno'/u);
  assert.match(status, /closed_without_offer:[\s\S]*?label: 'Zavrnjeno'/u);

  assert.match(server, /filter === 'preparation'[\s\S]*?qr\.status = 'in_preparation'/u);
  assert.match(server, /filter === 'received'[\s\S]*?qr\.status = 'received'/u);
  assert.match(server, /filter === 'issued'[\s\S]*?\('offer_issued','awaiting_purchase_order_review'\)/u);
  assert.match(server, /filter === 'ordered'[\s\S]*?\('accepted','converted_to_order'\)/u);
  assert.match(server, /filter === 'declined'[\s\S]*?\('declined','withdrawn','closed_without_offer'\)/u);
  assert.match(server, /filter === 'expired'[\s\S]*?qr\.status = 'expired'/u);
});

test('quote Uredi actions provide safe atomic quick editing before offer issue', () => {
  const table = source(quoteTablePath);
  const status = source(
    'src/shared/domain/quote/quoteRequestStatus.ts'
  );
  const types = source(
    'src/shared/domain/quote/quoteAdminTypes.ts'
  );
  const server = source('src/shared/server/quotes.ts');

  assert.match(table, /label: 'Hitro urejanje'/u);
  assert.match(table, /<AdminChipDropdown/u);
  assert.match(table, /QUOTE_REQUEST_MANUAL_STATUS_OPTIONS/u);
  assert.match(table, /draftCustomerName/u);
  assert.match(table, /expectedRequestStateVersion: quickEdit\.stateVersion/u);
  assert.match(table, /status: nextStatus/u);
  assert.match(table, /adminTableInlineConfirmButtonClassName/u);
  assert.match(table, /adminTableInlineCancelButtonClassName/u);
  assert.match(table, /disabled: !hasCompleteEditableSnapshot\(row\)/u);
  assert.match(
    status,
    /MANUALLY_EDITABLE_QUOTE_REQUEST_STATUSES = \[\s*'received',\s*'in_preparation'/u
  );

  for (const field of [
    'stateVersion',
    'organizationName',
    'contactName',
    'addressLine1',
    'postalCode',
    'city',
    'countryCode',
    'quoteReason'
  ]) {
    assert.match(types, new RegExp(`\\b${field}:`, 'u'));
  }
  assert.match(server, /qr\.state_version/u);
  assert.match(server, /qr\.address_line1/u);
  assert.match(server, /qr\.quote_reason/u);
});

test('quote table mirrors order selection and toolbar controls with guarded deletion actions', () => {
  const table = source(quoteTablePath);

  assert.match(table, /<AdminCheckbox/u);
  assert.match(table, /const \[selected, setSelected\] = useState<number\[\]>\(\[\]\)/u);
  assert.match(table, /const visibleQuoteIds = useMemo/u);
  assert.match(table, /selectedVisibleCount/u);
  assert.match(
    table,
    /selectAllRef\.current\.indeterminate\s*=\s*selectedVisibleCount > 0 && !allSelected/u
  );
  assert.match(table, /Array\.from\(new Set\(\[\.\.\.current, \.\.\.visibleQuoteIds\]\)\)/u);
  assert.match(table, /current\.filter\(\(id\) => visibleIdSet\.has\(id\)\)/u);
  assert.match(table, /adminTableRowToneClasses\.selected/u);
  assert.match(table, /aria-label="Izberi vse"/u);
  assert.match(
    table,
    /aria-label=\{`Izberi povpraševanje \$\{displayRequestNumber\}`\}/u
  );
  assert.match(table, /data-testid="quote-table-select-all"/u);
  assert.match(table, /data-testid=\{`quote-table-select-\$\{row\.id\}`\}/u);
  assert.match(table, /<col className="w-\[40px\]" \/>/u);
  assert.match(
    table,
    /Object\.values\(visibleColumns\)\.filter\(Boolean\)\.length \+ 2/u
  );

  const downloadIndex = table.indexOf('<DownloadIcon');
  const columnsIndex = table.indexOf('<ColumnVisibilityControl');
  assert.ok(downloadIndex >= 0 && downloadIndex < columnsIndex);
  assert.match(table, /headerRight=\{/u);
  assert.match(table, /adminTableToolbarActionsClassName/u);
  assert.match(table, /adminTableNeutralIconButtonClassName/u);
  assert.match(table, /<PanelAddRemoveIcon/u);
  assert.match(table, /showLabel=\{false\}/u);
  assert.match(table, /Prenesi izbrane \(\$\{selected\.length\}\)/u);
  assert.match(table, /'Prenesi vse dokumente'/u);
  assert.match(table, /TrashCanIcon/u);
  assert.match(table, /LazyConfirmDialog/u);
  assert.match(table, /method: 'DELETE'/u);
  assert.match(table, /response\.status === 409/u);
  assert.match(table, /JSON\.stringify\(\{ expectedStateVersion \}\)/u);
  assert.match(table, /QUOTE_REQUEST_VOID_BLOCKED/u);
  assert.match(table, /blockedDeleteReasons/u);
  assert.match(table, /Izbriši izbrana povpraševanja/u);
  assert.match(table, /AdminCreateManualQuoteRequestButton/u);
  assert.doesNotMatch(table, /\/close|\/withdraw/u);
});

test('manual quote intake creates a usable catalog-backed requested line', () => {
  const createButton = source(
    'src/admin/features/quotes/components/AdminCreateManualQuoteRequestButton.tsx'
  );

  assert.match(createButton, /Novo povpraševanje/u);
  assert.match(createButton, /\/api\/admin\/catalog-items/u);
  assert.match(createButton, /Poiščite po nazivu ali SKU/u);
  assert.match(createButton, /selectedCatalogChoice/u);
  assert.match(createButton, /requestedItems: \[/u);
  assert.match(createButton, /catalogItemId: selectedCatalogChoice\?\.catalogItemId/u);
  assert.match(createButton, /catalogVariantId: selectedCatalogChoice\?\.catalogVariantId/u);
  assert.match(createButton, /sku: selectedCatalogChoice\?\.sku/u);
  assert.match(createButton, /productName: selectedCatalogChoice\?\.name/u);
  assert.match(createButton, /quantity: requestedQuantity/u);
  assert.match(createButton, /unit: selectedCatalogChoice\?\.unit \?\? 'kos'/u);
  assert.match(createButton, /fetch\('\/api\/admin\/quote-requests'/u);
  assert.match(createButton, /method: 'POST'/u);
  assert.match(createButton, /intakeSource: draft\.intakeSource/u);
  assert.match(createButton, /router\.push\(`\/admin\/orders\/quotes\/\$\{quoteRequestId\}`\)/u);
  assert.match(createButton, /Prosti vnos/u);
});

test('quote list exposes only request-scoped immutable document summaries for toolbar downloads', () => {
  const table = source(quoteTablePath);
  const types = source('src/shared/domain/quote/quoteAdminTypes.ts');
  const server = source('src/shared/server/quotes.ts');

  assert.match(types, /downloadableDocuments: Array<\{/u);
  for (const field of ['id', 'offerVersionId', 'documentType', 'filename']) {
    assert.match(types, new RegExp('\\b' + field + ':', 'u'));
  }
  assert.doesNotMatch(types, /blob_pathname/u);

  assert.match(server, /coalesce\(latest_documents\.documents, '\[\]'::json\)/u);
  assert.match(server, /from quote_documents quote_document/u);
  assert.match(server, /join quote_offer_versions document_offer/u);
  assert.match(server, /document_offer\.quote_request_id = qr\.id/u);
  assert.match(server, /'offerVersionId', latest_document\.quote_offer_version_id/u);
  assert.match(server, /document_type in \('offer', 'purchase_order'\)/u);
  assert.match(server, /mapQuoteListDocuments\(row\.downloadable_documents\)/u);

  assert.match(
    table,
    /\/api\/admin\/quote-requests\/\$\{row\.id\}\/documents\/\$\{documentItem\.id\}/u
  );
  assert.match(table, /if \(!response\.ok\) return false/u);
  assert.match(table, /URL\.createObjectURL\(blob\)/u);
  assert.match(table, /URL\.revokeObjectURL\(tempLink\.href\)/u);
  assert.match(table, /Ni dokumentov za prenos glede na trenutno izbiro\./u);
});
