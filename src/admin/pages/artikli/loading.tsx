import { AdminItemsSectionSkeleton } from '@/admin/components/AdminPageSkeletons';

export default function AdminArtikliLoading() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Artikli</h1>
        <p className="mt-1 text-sm text-slate-600">Urejanje artiklov, statusov in prikaza v katalogu.</p>
      </div>
      <AdminItemsSectionSkeleton />
    </div>
  );
}
