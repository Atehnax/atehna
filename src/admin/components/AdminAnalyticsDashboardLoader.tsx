'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { AdminAnalyticsSectionSkeleton } from '@/admin/components/AdminPageSkeletons';
import type { OrdersAnalyticsResponse } from '@/shared/server/orderAnalytics';
import type { AnalyticsChartRow, AnalyticsGlobalAppearance } from '@/shared/server/analyticsCharts';

const LazyAdminAnalyticsDashboard = dynamic(() => import('@/admin/components/AdminAnalyticsDashboard'), {
  loading: () => <AdminAnalyticsSectionSkeleton />,
  ssr: false
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
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsReady(true), 220);
    return () => window.clearTimeout(timer);
  }, []);

  if (!isReady) {
    return <AdminAnalyticsSectionSkeleton />;
  }

  return (
    <LazyAdminAnalyticsDashboard
      initialData={initialData}
      initialCharts={initialCharts}
      initialFocusKey={initialFocusKey}
      initialAppearance={initialAppearance}
    />
  );
}
