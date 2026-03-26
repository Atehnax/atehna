'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Spinner } from '@/shared/ui/loading';
import { useToast } from '@/shared/ui/toast';

const rootLinks = [
  { href: '/', label: 'Prva stran', icon: 'home' },
  { href: '/admin/orders', label: 'Naročila', icon: 'orders' },
  { href: '/admin/artikli', label: 'Artikli', icon: 'products' },
  { href: '/admin/kategorije', label: 'Kategorije', icon: 'categories' },
  { href: '/admin/analitika', label: 'Analitika', icon: 'analytics' },
  { href: '/admin/kupci', label: 'Seznam kupcev', icon: 'customers' },
  { href: '/admin/celostna-podoba', label: 'Vizualna podoba', icon: 'visual' },
  { href: '/admin/arhiv', label: 'Arhiv', icon: 'archive' }
] as const;

type SidebarIconType = (typeof rootLinks)[number]['icon'] | 'logout';

function SidebarIcon({ type }: { type: SidebarIconType }) {
  if (type === 'home') return <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3.5 9.5 10 4l6.5 5.5"/><path d="M5.5 8.5V16h9V8.5"/></svg>;
  if (type === 'orders') return <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="4" y="3" width="12" height="14" rx="2.2"/><path d="M7 7h6"/><path d="M7 10.5h4.5"/><path d="M13 10.5h.01"/><path d="M7 14h4.5"/><path d="M13 14h.01"/></svg>;
  if (type === 'products') return <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="4" y="4" width="12" height="12" rx="2"/><path d="M7 8h6"/><path d="M7 12h6"/></svg>;
  if (type === 'categories') return <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3.5 4.5h5v4h-5z"/><path d="M11.5 4.5H16v4h-4.5z"/><path d="M7 8.5v2h6"/><path d="M10 10.5v5"/><path d="M7.5 13.5h5v3h-5z"/></svg>;
  if (type === 'analytics') return <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 16h14"/><path d="M5.5 13V9.5"/><path d="M10 13V6"/><path d="M14.5 13V4"/></svg>;
  if (type === 'customers') return <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="7" cy="7" r="2.3"/><circle cx="13.2" cy="8" r="1.8"/><path d="M3.2 15c.9-2 2.2-3 3.8-3s2.9 1 3.8 3"/><path d="M11.4 14.3c.5-1.3 1.4-2 2.6-2"/></svg>;
  if (type === 'visual') return <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M10 3a7 7 0 1 0 0 14h1.3a2 2 0 0 0 2-2 1.8 1.8 0 0 1 1.8-1.8h1A3.2 3.2 0 0 0 10 3z"/><circle cx="6.4" cy="8.1" r=".7" fill="currentColor"/><circle cx="9" cy="6.2" r=".7" fill="currentColor"/><circle cx="11.8" cy="6.2" r=".7" fill="currentColor"/></svg>;
  if (type === 'archive') return <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3.5 5h13v3h-13z"/><path d="M5 8v8h10V8"/><path d="M8 11h4"/></svg>;
  return <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 4h4v12h-4"/><path d="M8 6L4 10l4 4"/><path d="M4 10h9"/></svg>;
}

function ActiveChevron({ visible }: { visible: boolean }) {
  return (
    <span className={`ml-auto overflow-hidden text-[color:var(--blue-500)] transition-all duration-200 ${visible ? 'max-w-4 opacity-100' : 'max-w-0 opacity-0'}`} aria-hidden={!visible}>
      &gt;
    </span>
  );
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
      className="relative z-30 min-h-full w-72 shrink-0 self-stretch overflow-hidden border-r border-[color:var(--semantic-info-border)] bg-slate-50/55"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <aside
        className={`absolute inset-y-0 left-0 overflow-y-auto overflow-x-hidden bg-slate-50/90 shadow-sm transition-[width] duration-300 ease-out ${isExpanded ? 'w-72' : 'w-16'}`}
      >
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
              const isHome = link.href === '/';
              const isActive = isHome ? pathname === '/' : pathname === link.href || pathname.startsWith(`${link.href}/`);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  prefetch={false}
                  onMouseEnter={() => router.prefetch(link.href)}
                  onFocus={() => router.prefetch(link.href)}
                  className={`flex rounded-xl py-2 text-sm transition-all duration-200 ${isExpanded ? 'w-full items-center gap-2 px-2.5 pr-3' : 'mx-auto grid h-9 w-9 place-items-center'} ${
                    isActive
                      ? 'bg-white/75 font-semibold text-[color:var(--blue-500)]'
                      : 'text-slate-900 hover:bg-white/75 hover:text-[color:var(--blue-500)] focus-visible:text-[color:var(--blue-500)]'
                  }`}
                >
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
                    <SidebarIcon type={link.icon} />
                  </span>
                  <span
                    className={`overflow-hidden whitespace-nowrap transition-all duration-200 ${isExpanded ? 'max-w-[11.5rem] translate-x-0 opacity-100' : 'pointer-events-none max-w-0 -translate-x-1 opacity-0'}`}
                    aria-hidden={!isExpanded}
                  >
                    {link.label}
                  </span>
                  <ActiveChevron visible={isExpanded && isActive} />
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={isLoggingOut}
            className={`mt-auto flex rounded-xl py-2 text-sm transition-all duration-200 disabled:opacity-60 ${isExpanded ? 'w-full items-center gap-2 px-2.5 pr-3' : 'mx-auto grid h-9 w-9 place-items-center'} text-slate-900 hover:bg-white/75 hover:text-[color:var(--blue-500)] focus-visible:text-[color:var(--blue-500)]`}
          >
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
              <SidebarIcon type="logout" />
            </span>
            <span
              className={`overflow-hidden whitespace-nowrap transition-all duration-200 ${isExpanded ? 'max-w-[11.5rem] translate-x-0 opacity-100' : 'pointer-events-none max-w-0 -translate-x-1 opacity-0'}`}
              aria-hidden={!isExpanded}
            >
              {isLoggingOut ? <span className="inline-flex items-center gap-1.5"><Spinner size="sm" className="text-slate-500" />Odjava ...</span> : 'Odjava'}
            </span>
          </button>
        </div>
      </aside>
    </div>
  );
}
