import AdminAnalyticsDashboardLoader from '@/admin/components/AdminAnalyticsDashboardLoader';
import AdminAnalyticsTopTabs from '@/admin/components/AdminAnalyticsTopTabs';
import { emptyOrdersAnalyticsResponse, fetchOrdersAnalytics } from '@/shared/server/orderAnalytics';
import { fetchAnalyticsCharts, fetchGlobalAnalyticsAppearance } from '@/shared/server/analyticsCharts';
import { instrumentAdminRouteRender, profilePayloadEstimate, profileRoutePhase } from '@/shared/server/catalogDiagnostics';
import { getDatabaseUrl } from '@/shared/server/db';

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

  const [data, charts, appearance] = getDatabaseUrl()
    ? await Promise.all([
        fetchOrdersAnalytics({
          range: searchParams?.range,
          from: searchParams?.from,
          to: searchParams?.to,
          grouping: searchParams?.grouping
        }).catch(() => emptyOrdersAnalyticsResponse()),
        fetchAnalyticsCharts('narocila').catch(() => []),
        fetchGlobalAnalyticsAppearance('narocila').catch(() => fallbackAppearance)
      ])
    : [emptyOrdersAnalyticsResponse(), [], fallbackAppearance];

    await profileRoutePhase('payload', 'AdminAnalyticsDashboardSection:props', async () => {
      profilePayloadEstimate('AdminAnalyticsDashboardSection:data', data);
      profilePayloadEstimate('AdminAnalyticsDashboardSection:charts', charts);
      profilePayloadEstimate('AdminAnalyticsDashboardSection:appearance', appearance);
    });

    return (
      <AdminAnalyticsDashboardLoader
        initialData={data}
        initialCharts={charts}
        initialFocusKey={searchParams?.focus ?? ''}
        initialAppearance={appearance}
      />
    );
  });
}

export default async function AdminAnalyticsIndexPage({
  searchParams
}: {
  searchParams?: { range?: string; from?: string; to?: string; grouping?: string; view?: string; focus?: string };
}) {
  return (
    <div className="w-full">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-slate-900">Analitika</h1>
        <p className="mt-1 text-sm text-slate-500">Pregled analitike naročil in spletnega obiska.</p>
      </div>
      <AdminAnalyticsTopTabs />
      {await AdminAnalyticsDashboardSection({ searchParams })}
    </div>
  );
}
