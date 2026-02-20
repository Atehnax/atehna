'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminAnalyticsTopTabs() {
  const pathname = usePathname();
  const isWeb = pathname.startsWith('/admin/analitika/splet');

  return (
    <div className="mb-4 inline-flex rounded-xl border border-slate-300 bg-white p-1 shadow-sm">
      <Link
        href="/admin/analitika"
        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
          !isWeb ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
        }`}
      >
        Naročila
      </Link>
      <Link
        href="/admin/analitika/splet"
        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
          isWeb ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
        }`}
      >
        Splet
      </Link>
    </div>
  );
}
