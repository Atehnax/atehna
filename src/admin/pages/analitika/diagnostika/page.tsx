import AdminDiagnosticsDashboard from '@/admin/components/AdminDiagnosticsDashboard';
import AdminAnalyticsTopTabs from '@/admin/components/AdminAnalyticsTopTabs';

export const metadata = {
  title: 'Administracija analitika diagnostika'
};

export const dynamic = 'force-dynamic';

export default function AdminDiagnosticsPage() {
  return (
    <div className="w-full">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-slate-900">Analitika</h1>
        <p className="mt-1 text-sm text-slate-500">Pregled analitike naročil, spletnega obiska in operativne diagnostike.</p>
      </div>
      <AdminAnalyticsTopTabs />
      <AdminDiagnosticsDashboard />
    </div>
  );
}
