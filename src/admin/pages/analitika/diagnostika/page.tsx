import { Suspense } from 'react';
import AdminDiagnosticsDashboard from '@/admin/components/AdminDiagnosticsDashboard';
import AdminAnalyticsTopTabs from '@/admin/components/AdminAnalyticsTopTabs';
import { AdminDiagnosticsSectionSkeleton } from '@/admin/components/AdminPageSkeletons';

export const metadata = {
  title: 'Administracija analitika diagnostika'
};

export const dynamic = 'force-dynamic';

async function AdminDiagnosticsDashboardSection() {
  return <AdminDiagnosticsDashboard />;
}

export default function AdminDiagnosticsPage() {
  return (
    <div className="w-full">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-slate-900">Analitika</h1>
        <p className="mt-1 text-sm text-slate-500">Pregled analitike naročil, spletnega obiska in operativne diagnostike.</p>
      </div>
      <AdminAnalyticsTopTabs />
      <Suspense fallback={<AdminDiagnosticsSectionSkeleton />}>
        <AdminDiagnosticsDashboardSection />
      </Suspense>
    </div>
  );
}
