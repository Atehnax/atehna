import { Suspense } from 'react';
import AdminAnalyticsDashboard from '@/admin/components/AdminAnalyticsDashboard';
import AdminAnalyticsTopTabs from '@/admin/components/AdminAnalyticsTopTabs';
import { AdminAnalyticsSectionSkeleton } from '@/admin/components/AdminPageSkeletons';
import { emptyOrdersAnalyticsResponse, fetchOrdersAnalytics } from '@/shared/server/orderAnalytics';
import { fetchAnalyticsCharts, fetchGlobalAnalyticsAppearance } from '@/shared/server/analyticsCharts';
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
    <AdminAnalyticsDashboard
      initialData={data}
      initialCharts={charts}
      initialFocusKey={searchParams?.focus ?? ''}
      initialAppearance={appearance}
    />
  );
}

export default function AdminAnalyticsIndexPage({
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
      <Suspense fallback={<AdminAnalyticsSectionSkeleton />}>
        <AdminAnalyticsDashboardSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
