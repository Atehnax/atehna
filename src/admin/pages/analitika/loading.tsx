import AdminAnalyticsTopTabs from '@/admin/components/AdminAnalyticsTopTabs';
import { AdminAnalyticsSectionSkeleton } from '@/admin/components/AdminPageSkeletons';

export default function AdminAnalyticsLoading() {
  return (
    <div className="w-full">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-slate-900">Analitika</h1>
        <p className="mt-1 text-sm text-slate-500">Pregled analitike naročil in spletnega obiska.</p>
      </div>
      <AdminAnalyticsTopTabs />
      <AdminAnalyticsSectionSkeleton />
    </div>
  );
}
