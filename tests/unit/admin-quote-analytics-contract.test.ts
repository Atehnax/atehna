import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const QUOTE_FOCUS_KEYS = [
  'ponudbe-requests',
  'ponudbe-offers-issued',
  'ponudbe-accepted-converted',
  'ponudbe-conversion',
  'ponudbe-quoted-value',
  'ponudbe-converted-order-value'
] as const;

const sourceFocusKeys = (value: string) => Array.from(
  value.matchAll(/focusKey: '(ponudbe-[^']+)'/gu),
  (match) => match[1]
);

test('orders and quote summaries share the same analytics-card component and visual contract', () => {
  const sharedCard = source('src/shared/ui/admin-analytics-summary-card.tsx');
  const sharedComparison = source(
    'src/shared/ui/admin-analytics-comparison-row.tsx'
  );
  const ordersPreview = source('src/admin/features/orders/components/AdminOrdersPreviewChart.tsx');
  const quotesTable = source('src/admin/features/quotes/components/AdminQuotesTable.tsx');
  const quotesDashboard = source('src/admin/features/analitika/components/AdminQuoteAnalyticsDashboard.tsx');

  for (const consumer of [ordersPreview, quotesTable, quotesDashboard]) {
    assert.match(
      consumer,
      /import AdminAnalyticsSummaryCard from '@\/shared\/ui\/admin-analytics-summary-card'/u
    );
    assert.match(consumer, /<AdminAnalyticsSummaryCard/u);
  }

  assert.match(sharedCard, /min-h-\[94px\]/u);
  assert.match(sharedCard, /rounded-\[11px\]/u);
  assert.match(sharedCard, /px-5 py-\[11px\]/u);
  assert.match(sharedCard, /font-\['Inter',system-ui,sans-serif\]/u);
  assert.match(sharedCard, /text-\[11px\] font-bold uppercase/u);
  assert.match(sharedCard, /text-\[27px\] font-semibold/u);
  assert.match(sharedCard, /data-analytics-summary-card="true"/u);
  assert.doesNotMatch(ordersPreview, /min-h-\[94px\]/u);
  assert.doesNotMatch(quotesTable, /min-h-\[94px\]/u);
  for (const consumer of [ordersPreview, quotesTable]) {
    assert.match(
      consumer,
      /import AdminAnalyticsComparisonRow,[\s\S]*?from '@\/shared\/ui\/admin-analytics-comparison-row'/u
    );
    assert.match(consumer, /<AdminAnalyticsComparisonRow/u);
  }
  assert.match(
    sharedComparison,
    /data-analytics-comparison-period=\{item\.label\.toLowerCase\(\)\}/u
  );
  assert.match(sharedComparison, /tracking-\[0\.04em\]/u);
  assert.match(sharedComparison, /createAdminAnalyticsTrend/u);
});

test('all six quote summary cards deep-link with stable focus keys', () => {
  const quotesTable = source('src/admin/features/quotes/components/AdminQuotesTable.tsx');
  const quotesDashboard = source('src/admin/features/analitika/components/AdminQuoteAnalyticsDashboard.tsx');

  assert.deepEqual(sourceFocusKeys(quotesTable), [...QUOTE_FOCUS_KEYS]);
  assert.deepEqual(sourceFocusKeys(quotesDashboard), [...QUOTE_FOCUS_KEYS]);
  assert.match(
    quotesTable,
    /href=\{`\/admin\/analitika\/ponudbe\?range=max&focus=\$\{encodeURIComponent\(card\.focusKey\)\}`\}/u
  );
  assert.match(quotesDashboard, /new URLSearchParams\(\{ range: data\.range, focus: card\.focusKey \}\)/u);
  assert.match(quotesDashboard, /id=\{card\.focusKey\}/u);
  assert.match(quotesDashboard, /isFocused=\{focusedKey === card\.focusKey\}/u);
});

test('quote analytics are wired through the admin tab, page, API, and shared service', () => {
  const tabs = source('src/admin/features/analitika/components/AdminAnalyticsTopTabs.tsx');
  const page = source('src/admin/pages/analitika/ponudbe/page.tsx');
  const appPage = source('src/app/admin/analitika/ponudbe/page.tsx');
  const dashboard = source('src/admin/features/analitika/components/AdminQuoteAnalyticsDashboard.tsx');
  const api = source('src/admin/api/analytics/quotes/route.ts');
  const appApi = source('src/app/api/admin/analytics/quotes/route.ts');
  const ordersPage = source('src/admin/pages/orders/page.tsx');
  const quotesService = source('src/shared/server/quotes.ts');

  assert.match(tabs, /pathname\.startsWith\('\/admin\/analitika\/ponudbe'\)[\s\S]*?'quotes'/u);
  assert.match(tabs, /next === 'quotes'[\s\S]*?'\/admin\/analitika\/ponudbe'/u);
  assert.match(tabs, /\{ value: 'quotes', label: 'Povpraševanja in ponudbe' \}/u);

  assert.match(page, /fetchQuoteAnalytics/u);
  assert.match(page, /normalizeQuoteAnalyticsRange/u);
  assert.match(page, /<AdminQuoteAnalyticsDashboard/u);
  assert.match(page, /initialFocusKey=\{searchParams\?\.focus \?\? ''\}/u);
  assert.match(appPage, /@\/admin\/pages\/analitika\/ponudbe\/page/u);

  assert.match(api, /fetchQuoteAnalytics/u);
  assert.match(api, /normalizeQuoteAnalyticsRange/u);
  assert.match(api, /url\.searchParams\.get\('from'\)/u);
  assert.match(api, /url\.searchParams\.get\('to'\)/u);
  assert.match(appApi, /@\/admin\/api\/analytics\/quotes\/route/u);
  assert.match(dashboard, /fetch\(`\/api\/admin\/analytics\/quotes\?range=\$\{nextRange\}`\)/u);

  assert.match(ordersPage, /fetchAdminQuoteFunnel\(\)\.catch\(\(\) => null\)/u);
  assert.match(
    quotesService,
    /import \{ fetchQuoteAnalytics \} from '@\/shared\/server\/quoteAnalytics'/u
  );
  assert.match(
    quotesService,
    /fetchAdminQuoteFunnel[\s\S]*?buildQuoteAnalyticsComparisonWindows\(today\)[\s\S]*?Promise\.all\([\s\S]*?range: 'max'[\s\S]*?range: '30d'[\s\S]*?windows\.currentFrom[\s\S]*?range: '30d'[\s\S]*?windows\.previousFrom[\s\S]*?overall: overall\.summary[\s\S]*?last30Days: last30Days\.summary[\s\S]*?previous30Days: previous30Days\.summary/u
  );
  assert.match(quotesService, /new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/u);
  assert.doesNotMatch(quotesService, /analytics\.days\.slice/u);
});

test('all six quote cards show the shared current-versus-prior 30D footer', () => {
  const quotesTable = source(
    'src/admin/features/quotes/components/AdminQuotesTable.tsx'
  );

  assert.match(quotesTable, /const \{ overall, last30Days, previous30Days \} = funnel/u);
  for (const metric of [
    'requests',
    'offersIssued',
    'acceptedOrConverted',
    'conversionRate',
    'quotedValue',
    'convertedOrderValue'
  ]) {
    assert.match(
      quotesTable,
      new RegExp(
        `createAdminAnalyticsTrend\\([\\s\\S]*?last30Days\\.${metric},[\\s\\S]*?previous30Days\\.${metric}`,
        'u'
      )
    );
  }
  assert.match(quotesTable, /label: '30d'/u);
  assert.doesNotMatch(quotesTable, /helper: 'Vsi prejeti zahtevki'/u);
});

test('quote analytics SQL uses a bounded request cohort and pre-aggregated immutable facts', () => {
  const service = source('src/shared/server/quoteAnalytics.ts');

  assert.match(
    service,
    /first_issue[\s\S]*?min\(issued_at\) as issued_at[\s\S]*?issued_at < \$2::timestamptz[\s\S]*?group by quote_request_id/u
  );
  assert.match(
    service,
    /latest_issued[\s\S]*?distinct on \(quote_request_id\)[\s\S]*?issued_at is not null[\s\S]*?order by quote_request_id, issued_at desc, version_number desc, id desc/u
  );
  assert.match(
    service,
    /acceptance_facts[\s\S]*?quote_offer_acceptances[\s\S]*?union all[\s\S]*?quote_offer_versions[\s\S]*?accepted_at is not null[\s\S]*?first_acceptance[\s\S]*?min\(accepted_at\)[\s\S]*?group by quote_request_id/u
  );
  assert.match(
    service,
    /eligible_connected_orders[\s\S]*?sum\(order_record\.total\)[\s\S]*?order_record\.deleted_at is null[\s\S]*?order_record\.is_draft, false\) = false[\s\S]*?order_record\.contract_status = 'accepted'[\s\S]*?order_record\.commitment_status = 'binding'[\s\S]*?order_record\.status <> 'cancelled'[\s\S]*?group by source_offer\.quote_request_id/u
  );
  assert.match(
    service,
    /left join first_issue[\s\S]*?left join latest_issued[\s\S]*?left join first_acceptance[\s\S]*?left join eligible_connected_orders/u
  );
  assert.match(
    service,
    /where \(\$1::timestamptz is null or request\.created_at >= \$1::timestamptz\)[\s\S]*?and request\.created_at < \$2::timestamptz/u
  );
  assert.doesNotMatch(service, /converted_orders\.committed_at - first_issue\.issued_at/u);
});
