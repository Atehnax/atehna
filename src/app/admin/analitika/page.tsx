import AdminAnalyticsDashboard from '@/components/admin/AdminAnalyticsDashboard';
import AdminAnalyticsTopTabs from '@/components/admin/AdminAnalyticsTopTabs';
import { emptyOrdersAnalyticsResponse, fetchOrdersAnalytics } from '@/lib/server/orderAnalytics';
import { fetchAnalyticsCharts, fetchGlobalAnalyticsAppearance } from '@/lib/server/analyticsCharts';
import { getDatabaseUrl } from '@/lib/server/db';

export const metadata = {
  title: 'Administracija analitika'
};

export const dynamic = 'force-dynamic';

export default async function AdminAnalyticsIndexPage({
  searchParams
}: {
  searchParams?: { range?: string; from?: string; to?: string; grouping?: string; view?: string; focus?: string };
}) {
  const data = getDatabaseUrl()
    ? await fetchOrdersAnalytics({
        range: searchParams?.range,
        from: searchParams?.from,
        to: searchParams?.to,
        grouping: searchParams?.grouping
      }).catch(() => emptyOrdersAnalyticsResponse())
    : emptyOrdersAnalyticsResponse();

  const [charts, appearance] = getDatabaseUrl()
    ? await Promise.all([
        fetchAnalyticsCharts('narocila').catch(() => []),
        fetchGlobalAnalyticsAppearance('narocila').catch(() => ({
          sectionBg: '#f3f4f6',
          canvasBg: '#ffffff',
          cardBg: '#ffffff',
          plotBg: '#ffffff',
          axisTextColor: '#1f2937',
          seriesPalette: ['#2563eb', '#0ea5e9', '#14b8a6', '#f59e0b', '#ef4444'],
          gridColor: '#d1d5db',
          gridOpacity: 0.35
        }))
      ])
    : [[], { sectionBg: '#f3f4f6', canvasBg: '#ffffff', cardBg: '#ffffff', plotBg: '#ffffff', axisTextColor: '#1f2937', seriesPalette: ['#2563eb', '#0ea5e9', '#14b8a6', '#f59e0b', '#ef4444'], gridColor: '#d1d5db', gridOpacity: 0.35 }];

  return (
    <div className="w-full">
      <AdminAnalyticsTopTabs />
      <AdminAnalyticsDashboard
        initialData={data}
        initialCharts={charts}
        initialFocusKey={searchParams?.focus ?? ''}
        initialAppearance={appearance}
      />
    </div>
  );
}
