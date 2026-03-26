'use client';

import dynamic from 'next/dynamic';
const LazyAdminWebsiteAnalyticsDashboard = dynamic(
  () => import('@/admin/components/AdminWebsiteAnalyticsDashboard'),
  { ssr: false }
);

type AdminWebsiteAnalyticsDashboardProps = {
  visitsByDay: Array<{ day: string; visits: number }>;
  topPages: Array<{ path: string; views: number }>;
  topProducts: Array<{ product_id: string; views: number }>;
  returningVisitors7d: number;
  retentionByDay: Array<{ day: string; returning: number }>;
  initialFrom: string;
  initialTo: string;
};

export default function AdminWebsiteAnalyticsDashboardLoader(props: AdminWebsiteAnalyticsDashboardProps) {
  return <LazyAdminWebsiteAnalyticsDashboard {...props} />;
}
