import AdminWebsiteAnalyticsDashboard from '@/admin/components/AdminWebsiteAnalyticsDashboard';
import AdminAnalyticsTopTabs from '@/admin/components/AdminAnalyticsTopTabs';
import { fetchWebsiteAnalytics } from '@/shared/server/websiteAnalytics';
import { getDatabaseUrl } from '@/shared/server/db';
import { instrumentCatalogRouteEntry } from '@/shared/server/catalogDiagnostics';

export const metadata = {
  title: 'Administracija analitika splet'
};

export const dynamic = 'force-dynamic';

const toIsoOrNull = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

export default async function AdminWebsiteAnalyticsPage({
  searchParams
}: {
  searchParams?: { from?: string; to?: string };
}) {
  return instrumentCatalogRouteEntry('/admin/analitika/splet', async () => {
    const from = searchParams?.from ?? '';
    const to = searchParams?.to ?? '';

    const fallbackAnalytics = { visitsByDay: [], topPages: [], topProducts: [], returningVisitors7d: 0, retentionByDay: [] };
    const analytics = getDatabaseUrl()
      ? await fetchWebsiteAnalytics({ fromDate: toIsoOrNull(from), toDate: toIsoOrNull(to) }).catch(() => fallbackAnalytics)
      : fallbackAnalytics;

    return (
      <div className="w-full">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold text-slate-900">Analitika</h1>
          <p className="mt-1 text-sm text-slate-500">Pregled analitike naročil in spletnega obiska.</p>
        </div>
        <AdminAnalyticsTopTabs />
        <AdminWebsiteAnalyticsDashboard
          visitsByDay={analytics.visitsByDay}
          topPages={analytics.topPages}
          topProducts={analytics.topProducts}
          returningVisitors7d={analytics.returningVisitors7d}
          retentionByDay={analytics.retentionByDay}
          initialFrom={from}
          initialTo={to}
        />
      </div>
    );
  });
}
