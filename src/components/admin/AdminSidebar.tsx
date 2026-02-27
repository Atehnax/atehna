'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useToast } from '@/shared/ui/toast';

const rootLinks = [
  { href: '/admin/analitika', label: 'Analitika', icon: 'chart' },
  { href: '/admin/artikli', label: 'Artikli', icon: 'box' },
  { href: '/admin/orders', label: 'Naročila', icon: 'cart' },
  { href: '/admin/kupci', label: 'Seznam kupcev', icon: 'users' },
  { href: '/admin/celostna-podoba', label: 'Vizualna podoba', icon: 'palette' },
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
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { toast } = useToast();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const response = await fetch('/api/admin/logout', { method: 'POST' });
      if (!response.ok) {
        toast.error('Napaka pri odjavi');
        return;
      }

      toast.success('Odjava uspešna');
      router.push('/admin');
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error('Napaka pri odjavi');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <aside className={`sticky top-0 h-screen shrink-0 transition-all duration-300 ${isCollapsed ? 'w-10' : 'w-[19rem]'}`}>
      <div className="relative h-full overflow-visible border-r border-slate-200 bg-[#f8f7fc] shadow-sm">
        <button
          type="button"
          aria-label={isCollapsed ? 'Odpri meni' : 'Skrij meni'}
          onClick={() => setIsCollapsed((current) => !current)}
          className="absolute right-[-14px] top-3 z-20 inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-300 bg-white text-sm text-slate-600 shadow-sm transition hover:bg-[#ede8ff]"
        >
          <span aria-hidden="true">{isCollapsed ? '❯' : '❮'}</span>
        </button>

        <div className={`relative z-10 h-full px-3 py-10 transition-opacity duration-200 ${isCollapsed ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
          <div className="mb-5 px-2 pr-4">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#5d3ed6]">Administracija</p>
          </div>

          <div className="flex h-full flex-col">
            <nav className="space-y-1">
              {rootLinks.map((link) => {
                const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
                return (
                  <div key={link.href}>
                    <Link
                      href={link.href}
                      className={`flex items-center gap-2 rounded-xl px-2.5 py-2 pr-4 text-sm transition ${
                        isActive
                          ? 'bg-[#ede8ff] font-semibold text-[#5d3ed6]'
                          : 'text-[#5d3ed6] hover:bg-[#ede8ff] hover:text-[#5d3ed6]'
                      }`}
                    >
                      <SidebarIcon type={link.icon} />
                      <span>{link.label}</span>
                    </Link>
                  </div>
                );
              })}
            </nav>

            <div className="mt-auto border-t border-slate-200/80 pt-3">
              <button
                type="button"
                onClick={() => void handleLogout()}
                disabled={isLoggingOut}
                className="flex w-full items-center gap-2 rounded-xl border border-rose-200 bg-white px-2.5 py-2 pr-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="M12 4h4v12h-4"/>
                  <path d="M8 6L4 10l4 4"/>
                  <path d="M4 10h9"/>
                </svg>
                <span>{isLoggingOut ? 'Odjava ...' : 'Odjava'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
