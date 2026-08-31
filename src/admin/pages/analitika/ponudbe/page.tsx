import AdminAnalyticsTopTabs from '@/admin/features/analitika/components/AdminAnalyticsTopTabs';
import AdminQuoteAnalyticsDashboard from '@/admin/features/analitika/components/AdminQuoteAnalyticsDashboard';
import {
  emptyQuoteAnalyticsResponse,
  type QuoteAnalyticsRange
} from '@/shared/domain/quote/quoteAnalytics';
import { getDatabaseUrl } from '@/shared/server/db';
import {
  fetchQuoteAnalytics,
  normalizeQuoteAnalyticsRange
} from '@/shared/server/quoteAnalytics';
import { AdminPageHeader } from '@/shared/ui/admin-primitives';

export const metadata = {
  title: 'Analitika povpraševanj in ponudb'
};

export const dynamic = 'force-dynamic';

export default async function AdminQuoteAnalyticsPage(props: {
  searchParams?: Promise<{
    range?: string;
    from?: string;
    to?: string;
    focus?: string;
  }>;
}) {
  const searchParams = await props.searchParams;
  const range = normalizeQuoteAnalyticsRange(searchParams?.range);
  const data = getDatabaseUrl()
    ? await fetchQuoteAnalytics({
        range,
        from: searchParams?.from,
        to: searchParams?.to
      }).catch(() => emptyQuoteAnalyticsResponse(range as QuoteAnalyticsRange))
    : emptyQuoteAnalyticsResponse(range as QuoteAnalyticsRange);

  return (
    <div className="w-full">
      <AdminPageHeader
        title="Analitika"
        description="Pregled analitike naročil, povpraševanj, ponudb in spletnega obiska."
      />
      <AdminAnalyticsTopTabs />
      <AdminQuoteAnalyticsDashboard
        initialData={data}
        initialFocusKey={searchParams?.focus ?? ''}
      />
    </div>
  );
}
