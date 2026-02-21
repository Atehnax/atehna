'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/admin/arhiv', label: 'Arhiv naročil' },
  { href: '/admin/arhiv/artikli', label: 'Arhiv artiklov' }
];

export default function AdminArchiveTabs() {
  const pathname = usePathname();

  return (
    <div className="mb-4 inline-flex h-8 items-center gap-1 rounded-full border border-[#ede8ff] bg-[#f8f7fc] px-1">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${isActive ? 'bg-[#f8f7fc] border border-[#5d3ed6] text-[#5d3ed6]' : 'text-slate-700 hover:bg-slate-100'}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
