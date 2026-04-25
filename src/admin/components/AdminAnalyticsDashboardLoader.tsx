import AdminAnalyticsDashboard from '@/admin/components/AdminAnalyticsDashboard';
import type { AdminOrdersHeatmapDay } from '@/admin/components/AdminOrdersActivityHeatmap';
import type { OrdersAnalyticsResponse } from '@/shared/server/orderAnalytics';
import type { AnalyticsChartRow, AnalyticsGlobalAppearance } from '@/shared/server/analyticsCharts';

export default function AdminAnalyticsDashboardLoader({
  initialData,
  initialHeatmapDays,
  initialCharts,
  initialFocusKey,
  initialAppearance
}: {
  initialData: OrdersAnalyticsResponse;
  initialHeatmapDays: AdminOrdersHeatmapDay[];
  initialCharts: AnalyticsChartRow[];
  initialFocusKey?: string;
  initialAppearance: AnalyticsGlobalAppearance;
}) {
  return (
    <AdminAnalyticsDashboard
      initialData={initialData}
      initialHeatmapDays={initialHeatmapDays}
      initialCharts={initialCharts}
      initialFocusKey={initialFocusKey}
      initialAppearance={initialAppearance}
    />
  );
}
