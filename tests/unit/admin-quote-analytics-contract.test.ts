import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
test('ordinary order and quote summaries use the shared card presentation', () => {
  const sharedCard = source('src/shared/ui/admin-analytics-summary-card.tsx');
  const sharedComparison = source('src/shared/ui/admin-analytics-comparison-row.tsx');
  for (const path of ['src/admin/features/orders/components/AdminOrdersPreviewChart.tsx', 'src/admin/features/quotes/components/AdminQuoteAnalyticsPreview.tsx']) {
    const consumer = source(path);
    assert.match(consumer, /import AdminAnalyticsSummaryCard/u);
    assert.match(consumer, /<AdminAnalyticsSummaryCard/u);
    assert.match(consumer, /import AdminAnalyticsComparisonRow/u);
    assert.match(consumer, /<AdminAnalyticsComparisonRow/u);
    assert.doesNotMatch(consumer, /min-h-\[94px\]/u);
  }
  assert.match(sharedCard, /data-analytics-summary-card="true"/u);
  assert.match(sharedCard, /text-\[27px\] font-semibold/u);
  assert.match(sharedComparison, /data-analytics-comparison-period/u);
});
test('six quote cards link directly to canonical Ponudbe and disclose population and unavailable comparisons', () => {
  const cards = source('src/admin/features/quotes/components/AdminQuoteAnalyticsPreview.tsx');
  const preview = source('src/shared/domain/analytics/quotePreview.ts');
  for (const key of ['issued', 'mature', 'accepted', 'acceptanceRate', 'medianResponseHours', 'medianDecisionHours']) assert.ok(cards.includes("key: '" + key + "'"));
  assert.match(cards, /href=\{preview\.href\}/u);
  assert.match(cards, /previous > 0/u);
  assert.match(cards, /filtri tabele ne spreminjajo kartic/u);
  assert.match(preview, /view: 'ponudbe', range: '90D', asOf/u);
  assert.match(preview, /aggregateBusinessAnalytics/u);
  assert.match(preview, /projectBusinessQuoteSummary/u);
});
test('the ordinary quote workflow only reads the canonical opportunity loader for its preview', () => {
  const page = source('src/admin/pages/orders/page.tsx');
  const service = source('src/shared/server/businessAnalytics.ts');
  const quotes = source('src/shared/server/quotes.ts');
  assert.match(page, /fetchBusinessQuotePreview\(\)\.catch/u);
  assert.match(service, /buildBusinessQuotePreview\(await readQuotes\(client, asOf\), asOf\)/u);
  assert.doesNotMatch(quotes, /fetchQuoteAnalytics|fetchAdminQuoteFunnel/u);
  assert.match(quotes, /fetchAdminQuoteRequestsPage/u);
  assert.match(quotes, /fetchAdminQuoteDetail/u);
});
test('canonical quote facts preserve first issue and deduplicated acceptance and exclude tests and voids', () => {
  const service = source('src/shared/server/businessAnalytics.ts');
  assert.match(service, /first_issue[\s\S]*?distinct on \(quote_request_id\)[\s\S]*?order by quote_request_id, issued_at, version_number, id/u);
  assert.match(service, /acceptance_facts[\s\S]*?quote_offer_acceptances[\s\S]*?union all[\s\S]*?first_acceptance[\s\S]*?min\(accepted_at\)/u);
  assert.match(service, /request\.voided_at is null and request\.intake_source <> 'admin_testing'/u);
});
test('obsolete quote analytics modules, API and redirect pages no longer exist', () => {
  for (const path of ['src/shared/server/quoteAnalytics.ts', 'src/shared/domain/quote/quoteAnalytics.ts', 'src/admin/api/analytics/quotes/route.ts', 'src/app/api/admin/analytics/quotes/route.ts', 'src/admin/pages/analitika/ponudbe/page.tsx', 'src/app/admin/analitika/ponudbe/page.tsx']) assert.equal(existsSync(path), false, path);
  assert.doesNotMatch(source('src/shared/server/revalidateAdminQuotes.ts'), /analitika\/ponudbe/u);
});
