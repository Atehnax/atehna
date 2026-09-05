import { Suspense } from 'react';
import AdminAnalyticsTopTabs from '@/admin/features/analitika/components/AdminAnalyticsTopTabs';
import DiagnosticsDashboard from '@/admin/features/analitika/components/diagnostics/DiagnosticsDashboard';
export const metadata = { title: 'Administracija · Diagnostika' };
export const dynamic = 'force-dynamic';
export default function DiagnosticsPage() {
  return <div className="w-full"><div className="mb-4"><h1 className="text-2xl font-semibold text-slate-900">Analitika</h1><p className="mt-1 text-[13px] text-slate-500">Merjene zahteve, napake in poraba virov.</p></div><Suspense fallback={<p>Nalaganje …</p>}><AdminAnalyticsTopTabs /><DiagnosticsDashboard /></Suspense></div>;
}
