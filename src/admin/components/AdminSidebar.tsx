'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useToast } from '@/shared/ui/toast';
import { Spinner } from '@/shared/ui/loading';

const rootLinks = [
  { href: '/admin/orders', label: 'Naročila', icon: 'cart' },
  { href: '/admin/artikli', label: 'Artikli', icon: 'box' },
  { href: '/admin/kategorije', label: 'Kategorije', icon: 'tree' },
  { href: '/admin/analitika', label: 'Analitika', icon: 'chart' },
  { href: '/admin/kupci', label: 'Seznam kupcev', icon: 'users' },
  { href: '/admin/celostna-podoba', label: 'Vizualna podoba', icon: 'palette' },
  { href: '/admin/arhiv', label: 'Arhiv', icon: 'archive' }
] as const;

function SidebarIcon({ type }: { type: (typeof rootLinks)[number]['icon'] }) {
  if (type === 'chart') return <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 16h14"/><path d="M5 13V9"/><path d="M10 13V6"/><path d="M15 13V4"/></svg>;
  if (type === 'box') return <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 6.5L10 3l7 3.5v7L10 17l-7-3.5z"/><path d="M10 3v14"/></svg>;
  if (type === 'tree') return <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 4h5v4H4z"/><path d="M11 12h5v4h-5z"/><path d="M4 12h5v4H4z"/><path d="M6.5 8v2.5h7"/><path d="M13.5 10.5V12"/></svg>;
  if (type === 'cart') return <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="8" cy="16" r="1"/><circle cx="14" cy="16" r="1"/><path d="M2.5 4h2l1.2 7h8.6l1.2-5.5H6"/></svg>;
  if (type === 'users') return <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="7" cy="7" r="2.5"/><circle cx="13.5" cy="8" r="2"/><path d="M3 15c.8-2.1 2.2-3.2 4-3.2s3.2 1.1 4 3.2"/><path d="M12 14.6c.5-1.5 1.6-2.3 3-2.3"/></svg>;
  if (type === 'palette') return <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M10 3a7 7 0 100 14h1.5a2 2 0 002-2 2 2 0 012-2h1A3.5 3.5 0 0010 3z"/><circle cx="6.3" cy="8" r=".7" fill="currentColor"/><circle cx="8.8" cy="6.2" r=".7" fill="currentColor"/><circle cx="12" cy="6.2" r=".7" fill="currentColor"/></svg>;
  return <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 5h12v12H4z"/><path d="M7 5V3h6v2"/></svg>;
}

export default function AdminSidebar({ onExpandedChange }: { onExpandedChange?: (expanded: boolean) => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { toast } = useToast();

  const setExpanded = (expanded: boolean) => {
    setIsExpanded(expanded);
    onExpandedChange?.(expanded);
  };

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
    <div
      className={`min-h-full self-stretch shrink-0 overflow-hidden border-r border-[color:var(--semantic-info-border)] bg-slate-50/90 shadow-sm transition-[width] duration-300 ease-out ${isExpanded ? 'w-72' : 'w-16'}`}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <aside className="h-full min-h-full overflow-y-auto overflow-x-hidden">
        <div className="flex h-full min-h-full flex-col px-2 py-6">
          <div className={`mb-4 flex transition-all duration-200 ${isExpanded ? 'justify-start px-2' : 'justify-center px-0'}`}>
            <p
              className={`whitespace-nowrap text-sm font-semibold uppercase tracking-[0.12em] text-[color:var(--blue-500)] transition-all duration-200 ${isExpanded ? 'max-w-[12rem] translate-x-0 opacity-100' : 'max-w-0 -translate-x-1 opacity-0'}`}
              aria-hidden={!isExpanded}
            >
              Administracija
            </p>
          </div>

          <nav className="space-y-1">
            {rootLinks.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  prefetch={false}
                  onMouseEnter={() => router.prefetch(link.href)}
                  onFocus={() => router.prefetch(link.href)}
                  className={`group relative flex items-center rounded-xl py-2 text-sm transition-colors duration-200 ${isExpanded ? 'gap-2 px-2.5 pr-4' : 'justify-center px-0'} ${
                    isActive
                      ? 'font-semibold text-[color:var(--blue-500)]'
                      : 'text-slate-900 hover:bg-white/75 hover:text-[color:var(--blue-500)] focus-visible:text-[color:var(--blue-500)]'
                  }`}
                >
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
                    <SidebarIcon type={link.icon} />
                  </span>
                  <span
                    className={`overflow-hidden whitespace-nowrap transition-all duration-200 ${isExpanded ? 'max-w-[12rem] translate-x-0 opacity-100' : 'pointer-events-none max-w-0 -translate-x-1 opacity-0'}`}
                    aria-hidden={!isExpanded}
                  >
                    {link.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto border-t border-[color:var(--semantic-info-border)] pt-3">
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={isLoggingOut}
              className={`group flex w-full items-center rounded-xl border border-slate-300 bg-white/85 py-2 text-sm font-semibold text-slate-900 transition-all duration-200 hover:text-[color:var(--blue-500)] hover:bg-white disabled:opacity-60 ${isExpanded ? 'gap-2 px-2.5 pr-4 justify-start' : 'justify-center px-0'}`}
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M12 4h4v12h-4"/>
                <path d="M8 6L4 10l4 4"/>
                <path d="M4 10h9"/>
              </svg>
              <span
                className={`overflow-hidden whitespace-nowrap transition-all duration-200 ${isExpanded ? 'max-w-[12rem] translate-x-0 opacity-100' : 'pointer-events-none max-w-0 -translate-x-1 opacity-0'}`}
                aria-hidden={!isExpanded}
              >
                {isLoggingOut ? <span className="inline-flex items-center gap-1.5"><Spinner size="sm" className="text-slate-500" />Odjava ...</span> : 'Odjava'}
              </span>
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
