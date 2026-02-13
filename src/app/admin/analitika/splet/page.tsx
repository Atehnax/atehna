import AdminWebsiteAnalyticsDashboard from '@/components/admin/AdminWebsiteAnalyticsDashboard';
import { fetchWebsiteAnalytics } from '@/lib/server/websiteAnalytics';

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
  const from = searchParams?.from ?? '';
  const to = searchParams?.to ?? '';

  const analytics = process.env.DATABASE_URL
    ? await fetchWebsiteAnalytics({ fromDate: toIsoOrNull(from), toDate: toIsoOrNull(to) })
    : { visitsByDay: [], topPages: [], topProducts: [], returningVisitors7d: 0, retentionByDay: [] };

  return (
    <AdminWebsiteAnalyticsDashboard
      visitsByDay={analytics.visitsByDay}
      topPages={analytics.topPages}
      topProducts={analytics.topProducts}
      returningVisitors7d={analytics.returningVisitors7d}
      retentionByDay={analytics.retentionByDay}
      initialFrom={from}
      initialTo={to}
    />
  );
}
