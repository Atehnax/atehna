import AdminAnalyticsDashboard from '@/components/admin/AdminAnalyticsDashboard';
import { fetchOrders } from '@/lib/server/orders';

export const metadata = {
  title: 'Administracija analitika'
};

export const dynamic = 'force-dynamic';

const toIsoOrNull = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

export default async function AdminAnalyticsPage({
  searchParams
}: {
  searchParams?: { from?: string; to?: string };
}) {
  const from = searchParams?.from ?? '';
  const to = searchParams?.to ?? '';

  const orders = process.env.DATABASE_URL
    ? await fetchOrders({ fromDate: toIsoOrNull(from), toDate: toIsoOrNull(to) })
    : [];

  return <AdminAnalyticsDashboard orders={orders} initialFrom={from} initialTo={to} />;
}
