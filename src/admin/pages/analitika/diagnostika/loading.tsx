import AdminAnalyticsTopTabs from '@/admin/components/AdminAnalyticsTopTabs';
import { AdminDiagnosticsSectionSkeleton } from '@/admin/components/AdminPageSkeletons';

export default function AdminDiagnosticsLoading() {
  return (
    <div className="w-full">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-slate-900">Analitika</h1>
        <p className="mt-1 text-sm text-slate-500">Pregled analitike naročil, spletnega obiska in operativne diagnostike.</p>
      </div>
      <AdminAnalyticsTopTabs />
      <AdminDiagnosticsSectionSkeleton />
    </div>
  );
}
