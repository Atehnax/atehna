'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const rootLinks = [
  { href: '/admin/analitika', label: 'Analitika', icon: 'chart' },
  { href: '/admin/artikli', label: 'Artikli', icon: 'box' },
  { href: '/admin/orders', label: 'Naročila', icon: 'cart' },
  { href: '/admin/kupci', label: 'Seznam kupcev', icon: 'users' },
  { href: '/admin/celostna-podoba', label: 'Celostna podoba', icon: 'palette' },
  { href: '/admin/arhiv', label: 'Arhiv', icon: 'archive' }
] as const;

function SidebarIcon({ type }: { type: (typeof rootLinks)[number]['icon'] }) {
  if (type === 'chart') return <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 16h14"/><path d="M5 13V9"/><path d="M10 13V6"/><path d="M15 13V4"/></svg>;
  if (type === 'box') return <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 6.5L10 3l7 3.5v7L10 17l-7-3.5z"/><path d="M10 3v14"/></svg>;
  if (type === 'cart') return <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="8" cy="16" r="1"/><circle cx="14" cy="16" r="1"/><path d="M2.5 4h2l1.2 7h8.6l1.2-5.5H6"/></svg>;
  if (type === 'users') return <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="7" cy="7" r="2.5"/><circle cx="13.5" cy="8" r="2"/><path d="M3 15c.8-2.1 2.2-3.2 4-3.2s3.2 1.1 4 3.2"/><path d="M12 14.6c.5-1.5 1.6-2.3 3-2.3"/></svg>;
  if (type === 'palette') return <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M10 3a7 7 0 100 14h1.5a2 2 0 002-2 2 2 0 012-2h1A3.5 3.5 0 0010 3z"/><circle cx="6.3" cy="8" r=".7" fill="currentColor"/><circle cx="8.8" cy="6.2" r=".7" fill="currentColor"/><circle cx="12" cy="6.2" r=".7" fill="currentColor"/></svg>;
  return <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 5h12v12H4z"/><path d="M7 5V3h6v2"/></svg>;
}

export default function AdminSidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside className={`sticky top-0 h-screen shrink-0 transition-all duration-300 ${isCollapsed ? 'w-8' : 'w-64'}`}>
      <div className="relative h-full overflow-hidden border-r border-slate-200 bg-[#f8f7fc] shadow-sm">
        <button
          type="button"
          aria-label={isCollapsed ? 'Odpri meni' : 'Skrij meni'}
          onClick={() => setIsCollapsed((current) => !current)}
          className="absolute right-2 top-2 z-20 inline-flex h-5 w-5 items-center justify-center rounded-md border border-slate-300 bg-white text-[10px] text-slate-500 hover:bg-slate-50"
        >
          {isCollapsed ? '»' : '«'}
        </button>

        <div className={`relative z-10 h-full px-3 py-10 transition-opacity duration-200 ${isCollapsed ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
          <div className="mb-5 px-2 pr-4">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#4d2fd1]">Administracija</p>
          </div>
          <nav className="space-y-1">
            {rootLinks.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <div key={link.href}>
                  <Link
                    href={link.href}
                    className={`flex items-center gap-2 rounded-xl px-2.5 py-2 pr-4 text-xs transition ${
                      isActive
                        ? 'bg-[#ede8ff] font-semibold text-[#5a3fda]'
                        : 'text-slate-600 hover:bg-white hover:text-slate-900'
                    }`}
                  >
                    <SidebarIcon type={link.icon} />
                    <span>{link.label}</span>
                  </Link>
                </div>
              );
            })}
          </nav>
        </div>
      </div>
    </aside>
  );
}
