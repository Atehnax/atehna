'use client';

import dynamic from 'next/dynamic';
import { AdminAnalyticsSectionSkeleton } from '@/admin/components/AdminPageSkeletons';
import type { OrdersAnalyticsResponse } from '@/shared/server/orderAnalytics';
import type { AnalyticsChartRow, AnalyticsGlobalAppearance } from '@/shared/server/analyticsCharts';

const LazyAdminAnalyticsDashboard = dynamic(() => import('@/admin/components/AdminAnalyticsDashboard'), {
  loading: () => <AdminAnalyticsSectionSkeleton />
});

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
    <LazyAdminAnalyticsDashboard
      initialData={initialData}
      initialCharts={initialCharts}
      initialFocusKey={initialFocusKey}
      initialAppearance={initialAppearance}
    />
  );
}
