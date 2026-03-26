import AdminAnalyticsDashboard from '@/admin/components/AdminAnalyticsDashboard';
import type { OrdersAnalyticsResponse } from '@/shared/server/orderAnalytics';
import type { AnalyticsChartRow, AnalyticsGlobalAppearance } from '@/shared/server/analyticsCharts';

export default function AdminAnalyticsDashboardLoader({
  initialData,
  initialCharts,
  initialFocusKey,
  initialAppearance
}: {
  initialData: OrdersAnalyticsResponse;
  initialCharts: AnalyticsChartRow[];
  initialFocusKey?: string;
  initialAppearance: AnalyticsGlobalAppearance;
}) {
  return (
    <AdminAnalyticsDashboard
      initialData={initialData}
      initialCharts={initialCharts}
      initialFocusKey={initialFocusKey}
      initialAppearance={initialAppearance}
    />
  );
}
