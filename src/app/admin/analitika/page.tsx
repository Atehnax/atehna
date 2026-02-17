import AdminAnalyticsDashboard from '@/components/admin/AdminAnalyticsDashboard';
import { emptyOrdersAnalyticsResponse, fetchOrdersAnalytics } from '@/lib/server/orderAnalytics';
import { fetchAnalyticsCharts } from '@/lib/server/analyticsCharts';
import { getDatabaseUrl } from '@/lib/server/db';

export const metadata = {
  title: 'Administracija analitika'
};

export const dynamic = 'force-dynamic';

export default async function AdminAnalyticsIndexPage({
  searchParams
}: {
  searchParams?: { range?: string; from?: string; to?: string; grouping?: string; view?: string };
}) {
  const data = getDatabaseUrl()
    ? await fetchOrdersAnalytics({
        range: searchParams?.range,
        from: searchParams?.from,
        to: searchParams?.to,
        grouping: searchParams?.grouping
      }).catch(() => emptyOrdersAnalyticsResponse())
    : emptyOrdersAnalyticsResponse();

  const charts = getDatabaseUrl() ? await fetchAnalyticsCharts('narocila').catch(() => []) : [];

  return (
    <div className="w-full px-6 py-12">
      <AdminAnalyticsDashboard initialData={data} initialCharts={charts} />
    </div>
  );
}
