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
    <div className="mb-4 flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${isActive ? 'border-brand-500 bg-[#f8f7fc] text-brand-700' : 'border-slate-300 bg-[#f8f7fc] text-slate-600 hover:bg-[#f2f0fb]'}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
