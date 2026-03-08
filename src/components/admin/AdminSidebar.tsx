'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useToast } from '@/shared/ui/toast';
import { Spinner } from '@/shared/ui/loading';

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


function SidebarHandle({ isCollapsed, onToggle }: { isCollapsed: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-label={isCollapsed ? 'Odpri meni' : 'Skrij meni'}
      onClick={onToggle}
      className="absolute right-[-14px] top-3 z-40 inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[color:var(--semantic-info-border)] bg-white text-sm text-[color:var(--semantic-info)] shadow-sm transition hover:bg-[color:var(--blue-100)]"
    >
      <span aria-hidden="true">{isCollapsed ? '❯' : '❮'}</span>
    </button>
  );
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
    <div className={`relative min-h-full self-stretch shrink-0 overflow-visible transition-all duration-300 ${isCollapsed ? 'w-10' : 'w-[19rem]'}`}>
      <aside className="h-full min-h-full overflow-y-auto overflow-x-visible border-r border-[color:var(--semantic-info-border)] bg-slate-50/90 shadow-sm">
        <div className={`relative z-10 flex h-full min-h-full flex-col px-3 py-10 transition-opacity duration-200 ${isCollapsed ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
          <div className="mb-5 px-2 pr-4">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[color:var(--semantic-info)]">Administracija</p>
          </div>

          <div className="flex h-full min-h-full flex-col">
            <nav className="space-y-1">
              {rootLinks.map((link) => {
                const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
                return (
                  <div key={link.href}>
                    <Link
                      href={link.href}
                      className={`flex items-center gap-2 rounded-xl px-2.5 py-2 pr-4 text-sm transition ${
                        isActive
                          ? 'font-semibold text-[color:var(--blue-700)]'
                          : 'text-[color:var(--semantic-info)] hover:bg-white/75 hover:text-[color:var(--blue-700)]'
                      }`}
                    >
                      <SidebarIcon type={link.icon} />
                      <span>{link.label}</span>
                    </Link>
                  </div>
                );
              })}
            </nav>

            <div className="mt-3 border-t border-[color:var(--semantic-info-border)] pt-3">
              <button
                type="button"
                onClick={() => void handleLogout()}
                disabled={isLoggingOut}
                className="flex w-full items-center gap-2 rounded-xl border border-slate-300 bg-white/85 px-2.5 py-2 pr-4 text-sm font-semibold text-slate-700 transition hover:bg-white disabled:opacity-60"
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="M12 4h4v12h-4"/>
                  <path d="M8 6L4 10l4 4"/>
                  <path d="M4 10h9"/>
                </svg>
                <span>{isLoggingOut ? <span className="inline-flex items-center gap-1.5"><Spinner size="sm" className="text-slate-500" />Odjava ...</span> : 'Odjava'}</span>
              </button>
            </div>
          </div>
        </div>
      </aside>
      <SidebarHandle isCollapsed={isCollapsed} onToggle={() => setIsCollapsed((current) => !current)} />
    </div>
  );
}
