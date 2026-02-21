'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminAnalyticsTopTabs() {
  const pathname = usePathname();
  const isWeb = pathname.startsWith('/admin/analitika/splet');

  return (
    <div className="mb-4 inline-flex h-8 items-center gap-1 rounded-full border border-slate-300 bg-white px-1">
      <Link
        href="/admin/analitika"
        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
          !isWeb ? 'bg-[#ede8fe] text-[#5a3fda]' : 'text-slate-700 hover:bg-slate-50'
        }`}
      >
        Naročila
      </Link>
      <Link
        href="/admin/analitika/splet"
        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
          isWeb ? 'bg-[#ede8fe] text-[#5a3fda]' : 'text-slate-700 hover:bg-slate-50'
        }`}
      >
        Splet
      </Link>
    </div>
  );
}
