import { Suspense } from 'react';
import BusinessDashboard from '@/admin/features/analitika/components/business/BusinessDashboard';

export const metadata = { title: 'Poslovna analitika | Atehna' };
export const dynamic = 'force-dynamic';

export default function AdminAnalyticsIndexPage() {
  return <div className="w-full">
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">Nalaganje poslovne analitike …</p>}><BusinessDashboard /></Suspense>
  </div>;
}
