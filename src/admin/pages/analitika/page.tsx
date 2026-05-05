import AdminAnalyticsDashboardLoader from '@/admin/features/analitika/components/AdminAnalyticsDashboardLoader';
import AdminAnalyticsTopTabs from '@/admin/features/analitika/components/AdminAnalyticsTopTabs';
import { emptyOrdersAnalyticsResponse, fetchOrdersAnalytics } from '@/shared/server/orderAnalytics';
import { fetchAnalyticsCharts, fetchGlobalAnalyticsAppearance } from '@/shared/server/analyticsCharts';
import { instrumentAdminRouteRender, profilePayloadEstimate, profileRoutePhase } from '@/shared/server/catalogDiagnostics';
import { getDatabaseUrl } from '@/shared/server/db';
import { AdminPageHeader } from '@/shared/ui/admin-primitives';

export const metadata = {
  title: 'Administracija analitika'
};

export const dynamic = 'force-dynamic';

async function AdminAnalyticsDashboardSection({
  searchParams
}: {
  searchParams?: { range?: string; from?: string; to?: string; grouping?: string; view?: string; focus?: string };
}) {
  return instrumentAdminRouteRender('/admin/analitika', async () => {
    const fallbackAppearance = { sectionBg: '#f3f4f6', canvasBg: '#ffffff', cardBg: '#ffffff', plotBg: '#ffffff', axisTextColor: '#1f2937', seriesPalette: ['#2563eb', '#0ea5e9', '#14b8a6', '#f59e0b', '#ef4444'], gridColor: '#d1d5db', gridOpacity: 0.35 };

  const [data, heatmapData, charts, appearance] = getDatabaseUrl()
    ? await Promise.all([
        fetchOrdersAnalytics({
          range: searchParams?.range,
          from: searchParams?.from,
          to: searchParams?.to,
          grouping: searchParams?.grouping
        }).catch(() => emptyOrdersAnalyticsResponse()),
        fetchOrdersAnalytics({
          range: '365d',
          grouping: 'day'
        }).catch(() => emptyOrdersAnalyticsResponse('365d')),
        fetchAnalyticsCharts('narocila').catch(() => []),
        fetchGlobalAnalyticsAppearance('narocila').catch(() => fallbackAppearance)
      ])
    : [emptyOrdersAnalyticsResponse(), emptyOrdersAnalyticsResponse('365d'), [], fallbackAppearance];

    await profileRoutePhase('payload', 'AdminAnalyticsDashboardSection:props', async () => {
      profilePayloadEstimate('AdminAnalyticsDashboardSection:data', data);
      profilePayloadEstimate('AdminAnalyticsDashboardSection:heatmapData', heatmapData);
      profilePayloadEstimate('AdminAnalyticsDashboardSection:charts', charts);
      profilePayloadEstimate('AdminAnalyticsDashboardSection:appearance', appearance);
    });

    return (
      <AdminAnalyticsDashboardLoader
        initialData={data}
        initialHeatmapDays={heatmapData.days.map((day) => ({
          date: day.date,
          order_count: day.order_count,
          revenue_total: day.revenue_total
        }))}
        initialCharts={charts}
        initialFocusKey={searchParams?.focus ?? ''}
        initialAppearance={appearance}
      />
    );
  });
}

export default async function AdminAnalyticsIndexPage(
  props: {
    searchParams?: Promise<{ range?: string; from?: string; to?: string; grouping?: string; view?: string; focus?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  return (
    <div className="w-full">
      <AdminPageHeader title="Analitika" description="Pregled analitike naročil in spletnega obiska." />
      <AdminAnalyticsTopTabs />
      {await AdminAnalyticsDashboardSection({ searchParams })}
    </div>
  );
}
