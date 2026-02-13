import Link from 'next/link';
import { fetchArchiveEntries } from '@/lib/server/deletedArchive';

export const metadata = { title: 'Arhiv izbrisanih' };
export const dynamic = 'force-dynamic';

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('sl-SI', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

export default async function AdminDeletedArchivePage() {
  const entries = process.env.DATABASE_URL ? await fetchArchiveEntries('all') : [];

  return (
    <div className="w-full px-6 py-12">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Arhiv izbrisanih</h1>
            <p className="mt-2 text-sm text-slate-600">Zadnjih 60 dni izbrisanih naročil in PDF datotek.</p>
          </div>
          <Link href="/admin/orders" className="text-sm font-semibold text-brand-600">
            ← Nazaj na naročila
          </Link>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Vrsta</th>
                <th className="px-4 py-3">Opis</th>
                <th className="px-4 py-3">Izbrisano</th>
                <th className="px-4 py-3">Poteče</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={4}>
                    Trenutno ni elementov v arhivu.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                        {entry.item_type === 'order' ? 'Naročilo' : 'PDF datoteka'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{entry.label}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDateTime(entry.deleted_at)}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDateTime(entry.expires_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
