import { Suspense } from 'react';
import AdminAnalyticsTopTabs from '@/admin/features/analitika/components/AdminAnalyticsTopTabs';
import BusinessDashboard from '@/admin/features/analitika/components/business/BusinessDashboard';
import { AdminPageHeader } from '@/shared/ui/admin-primitives';

export const metadata = { title: 'Poslovna analitika | Atehna' };
export const dynamic = 'force-dynamic';

export default function AdminAnalyticsIndexPage() {
  return <div className="w-full">
    <AdminPageHeader title="Analitika" description="Naročila, ponudbe in naročniki — od pregleda do pripadajočih zapisov." />
    <AdminAnalyticsTopTabs />
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">Nalaganje poslovne analitike …</p>}><BusinessDashboard /></Suspense>
  </div>;
}
