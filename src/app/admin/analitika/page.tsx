import AdminAnalyticsDashboard from '@/components/admin/AdminAnalyticsDashboard';
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
          sectionBg: '#0b1220',
          canvasBg: '#0f172a',
          cardBg: '#1e293b',
          plotBg: '#1e293b',
          axisTextColor: '#94a3b8',
          seriesPalette: ['#22d3ee', '#f59e0b', '#a78bfa', '#34d399', '#60a5fa'],
          gridColor: '#94a3b8',
          gridOpacity: 0.2
        }))
      ])
    : [[], { sectionBg: '#0b1220', canvasBg: '#0f172a', cardBg: '#1e293b', plotBg: '#1e293b', axisTextColor: '#94a3b8', seriesPalette: ['#22d3ee', '#f59e0b', '#a78bfa', '#34d399', '#60a5fa'], gridColor: '#94a3b8', gridOpacity: 0.2 }];

  return (
    <div className="w-full px-6 py-12">
      <AdminAnalyticsDashboard
        initialData={data}
        initialCharts={charts}
        initialFocusKey={searchParams?.focus ?? ''}
        initialAppearance={appearance}
      />
    </div>
  );
}
