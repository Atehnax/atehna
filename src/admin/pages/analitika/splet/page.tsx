import { Suspense } from 'react';
import AdminAnalyticsTopTabs from '@/admin/features/analitika/components/AdminAnalyticsTopTabs';
import WebsiteDashboard from '@/admin/features/analitika/components/website/WebsiteDashboard';

export const metadata = { title: 'Splet | Analitika' };
export const dynamic = 'force-dynamic';
export default function WebsiteAnalyticsPage() {
  return <div className="w-full"><AdminAnalyticsTopTabs /><Suspense fallback={<p className="p-6 text-sm text-slate-500">Nalaganje spletne analitike …</p>}><WebsiteDashboard /></Suspense></div>;
}
