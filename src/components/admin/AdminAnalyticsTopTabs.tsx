'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminAnalyticsTopTabs() {
  const pathname = usePathname();
  const isWeb = pathname.startsWith('/admin/analitika/splet');

  return (
    <div className="mb-4 inline-flex h-8 items-center gap-1 rounded-full border border-[#ede8ff] bg-[#f8f7fc] px-1">
      <Link
        href="/admin/analitika"
        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
          !isWeb ? 'bg-[#f8f7fc] border border-[#5d3ed6] text-[#5d3ed6]' : 'text-slate-700 hover:bg-slate-100'
        }`}
      >
        Naročila
      </Link>
      <Link
        href="/admin/analitika/splet"
        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
          isWeb ? 'bg-[#f8f7fc] border border-[#5d3ed6] text-[#5d3ed6]' : 'text-slate-700 hover:bg-slate-100'
        }`}
      >
        Splet
      </Link>
    </div>
  );
}
