'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const rootLinks = [
  {
    label: 'Analitika',
    href: '/admin/analitika/narocila',
    children: [
      { href: '/admin/analitika/narocila', label: 'Naročila' },
      { href: '/admin/analitika/splet', label: 'Splet' }
    ]
  },
  { href: '/admin/artikli', label: 'Artikli' },
  { href: '/admin/orders', label: 'Naročila' },
  { href: '/admin/kupci', label: 'Seznam kupcev' },
  { href: '/admin/celostna-podoba', label: 'Celostna podoba' },
  { href: '/admin/arhiv-izbrisanih', label: 'Arhiv izbrisanih' }
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 border-r border-slate-200 bg-white/90 px-4 py-6">
      <div className="mb-6 px-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Administracija</p>
      </div>
      <nav className="space-y-1">
        {rootLinks.map((link) => {
          const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
          const hasChildren = 'children' in link;
          return (
            <div key={link.href}>
              <Link
                href={link.href}
                className={`block rounded-lg px-3 py-2 text-sm transition ${
                  isActive || (hasChildren && pathname.startsWith('/admin/analitika'))
                    ? 'bg-slate-100 font-semibold text-slate-900'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {link.label}
              </Link>
              {hasChildren && (
                <div className="ml-3 mt-1 space-y-1 border-l border-slate-200 pl-2">
                  {(link.children ?? []).map((child) => {
                    const childActive = pathname === child.href || pathname.startsWith(`${child.href}/`);
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`block rounded px-2 py-1 text-xs transition ${
                          childActive ? 'bg-slate-100 font-semibold text-slate-800' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                        }`}
                      >
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
