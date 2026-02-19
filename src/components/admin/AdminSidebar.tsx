'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

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

  return (
    <aside className="w-64 shrink-0 border-r border-slate-900/60 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-6 text-slate-200 shadow-[inset_-1px_0_0_rgba(255,255,255,0.04)]">
      <div className="mb-6 px-2">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Administracija</p>
      </div>
      <nav className="space-y-1">
        {rootLinks.map((link) => {
          const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <div key={link.href}>
              <Link
                href={link.href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-900/50 to-slate-800 font-semibold text-cyan-100 shadow-[inset_0_0_0_1px_rgba(148,214,230,0.25)]'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <SidebarIcon type={link.icon} />
                <span>{link.label}</span>
              </Link>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
