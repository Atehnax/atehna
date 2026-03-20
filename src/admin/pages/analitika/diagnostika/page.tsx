import { Suspense } from 'react';
import AdminDiagnosticsDashboard from '@/admin/components/AdminDiagnosticsDashboard';
import AdminAnalyticsTopTabs from '@/admin/components/AdminAnalyticsTopTabs';
import { AdminDiagnosticsSectionSkeleton } from '@/admin/components/AdminPageSkeletons';

export const metadata = {
  title: 'Administracija analitika diagnostika'
};

export const dynamic = 'force-dynamic';

const WINDOW_MINUTE_TO_HOURS: Record<string, number> = {
  '5m': 5 / 60,
  '15m': 0.25,
  '60m': 1,
  '6h': 6,
  '24h': 24
};

function resolveWindowHours(windowParam?: string) {
  return WINDOW_MINUTE_TO_HOURS[windowParam ?? ''] ?? 5 / 60;
}

async function AdminDiagnosticsDashboardSection({
  searchParams
}: {
  searchParams?: { window?: string };
}) {
  return <AdminDiagnosticsDashboard windowHours={resolveWindowHours(searchParams?.window)} />;
}

export default function AdminDiagnosticsPage({
  searchParams
}: {
  searchParams?: { window?: string };
}) {
  return (
    <div className="w-full">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-slate-900">Analitika</h1>
        <p className="mt-1 text-sm text-slate-500">Pregled analitike naročil, spletnega obiska in operativne diagnostike.</p>
      </div>
      <AdminAnalyticsTopTabs />
      <Suspense fallback={<AdminDiagnosticsSectionSkeleton />}>
        <AdminDiagnosticsDashboardSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
