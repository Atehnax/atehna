'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Spinner } from '@/shared/ui/loading';
import { useToast } from '@/shared/ui/toast';

const primaryLinks = [
  { href: '/admin/orders', label: 'Naročila', icon: ClipboardListIcon },
  { href: '/admin/artikli', label: 'Artikli', icon: PackageIcon },
  { href: '/admin/kategorije', label: 'Kategorije', icon: NetworkIcon },
  { href: '/admin/analitika', label: 'Analitika', icon: ChartColumnIcon },
  { href: '/admin/kupci', label: 'Seznam kupcev', icon: UsersIcon },
  { href: '/admin/celostna-podoba', label: 'Vizualna podoba', icon: PaletteIcon },
  { href: '/admin/katalog', label: 'Katalog', icon: BookOpenTextIcon },
  { href: '/admin/urejanje-dokumentov', label: 'Urejanje dokumentov', icon: FilePenLineIcon },
  { href: '/admin/arhiv', label: 'Arhiv', icon: ArchiveIcon },
  { href: '/admin/dnevnik', label: 'Dnevnik sprememb', icon: HistoryIcon }
] as const;

const bottomLinks = [{ href: '/', label: 'Glavna stran', icon: 'home' }] as const;

type SidebarIconType = (typeof bottomLinks)[number]['icon'] | 'logout';

const COLLAPSED_WIDTH = 'w-16';
const EXPANDED_WIDTH = 'w-[14.5rem]';
const sidebarIconWrapperClassName = 'inline-flex h-4 w-4 shrink-0 items-center justify-center';
const sidebarIconClassName = 'h-4 w-4 shrink-0';
const sidebarLogoIconWrapperClassName = 'inline-flex h-4 w-4 shrink-0 items-center justify-center';
const sidebarLogoIconClassName = 'h-4 w-4 shrink-0';
const sidebarSvgProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true
} as const;

function AtehnaMarkIcon({ className }: { className?: string }) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.35}
      strokeLinecap="butt"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <circle cx="16" cy="4.9" r="3.25" strokeLinecap="round" />
      <path d="M13.75 7.85 7.65 18.35 19.75 18.35" />
      <path d="M0.95 30 4.85 23.15 17.35 23.15" />
      <path d="M18.25 7.85 24.05 19.45" />
      <path d="M25.75 23.25 29.25 30" />
      <path d="M21.23 20.85 26.87 18.05" />
      <path d="M22.93 24.65 28.57 21.85" />
    </svg>
  );
}

function ClipboardListIcon({ className }: { className?: string }) {
  return (
    <svg {...sidebarSvgProps} className={className}>
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M12 11h4" />
      <path d="M12 16h4" />
      <path d="M8 11h.01" />
      <path d="M8 16h.01" />
    </svg>
  );
}

function PackageIcon({ className }: { className?: string }) {
  return (
    <svg {...sidebarSvgProps} className={className}>
      <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" />
      <path d="M12 22V12" />
      <polyline points="3.29 7 12 12 20.71 7" />
      <path d="m7.5 4.27 9 5.15" />
    </svg>
  );
}

function NetworkIcon({ className }: { className?: string }) {
  return (
    <svg {...sidebarSvgProps} className={className}>
      <rect x="16" y="16" width="6" height="6" rx="1" />
      <rect x="2" y="16" width="6" height="6" rx="1" />
      <rect x="9" y="2" width="6" height="6" rx="1" />
      <path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3" />
      <path d="M12 12V8" />
    </svg>
  );
}

function ChartColumnIcon({ className }: { className?: string }) {
  return (
    <svg {...sidebarSvgProps} className={className}>
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg {...sidebarSvgProps} className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <path d="M16 3.128a4 4 0 0 1 0 7.744" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <circle cx="9" cy="7" r="4" />
    </svg>
  );
}

function PaletteIcon({ className }: { className?: string }) {
  return (
    <svg {...sidebarSvgProps} className={className}>
      <path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z" />
      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
      <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
      <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
    </svg>
  );
}

function BookOpenTextIcon({ className }: { className?: string }) {
  return (
    <svg {...sidebarSvgProps} className={className}>
      <path d="M12 7v14" />
      <path d="M16 12h2" />
      <path d="M16 8h2" />
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
      <path d="M6 12h2" />
      <path d="M6 8h2" />
    </svg>
  );
}

function FilePenLineIcon({ className }: { className?: string }) {
  return (
    <svg {...sidebarSvgProps} className={className}>
      <path d="M14.364 13.634a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506l4.013-4.009a1 1 0 0 0-3.004-3.004z" />
      <path d="M14.487 7.858A1 1 0 0 1 14 7V2" />
      <path d="M20 19.645V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l2.516 2.516" />
      <path d="M8 18h1" />
    </svg>
  );
}

function ArchiveIcon({ className }: { className?: string }) {
  return (
    <svg {...sidebarSvgProps} className={className}>
      <rect width="20" height="5" x="2" y="3" rx="1" />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <path d="M10 12h4" />
    </svg>
  );
}

function HistoryIcon({ className }: { className?: string }) {
  return (
    <svg {...sidebarSvgProps} className={className}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </svg>
  );
}

function SidebarIcon({ type }: { type: SidebarIconType }) {
  if (type === 'home') {
    return (
      <svg {...sidebarSvgProps} className={sidebarIconClassName}>
        <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
        <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      </svg>
    );
  }

  return (
    <svg {...sidebarSvgProps} className={sidebarIconClassName}>
      <g transform="translate(24 0) scale(-1 1)">
        <path d="m16 17 5-5-5-5" />
        <path d="M21 12H9" />
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      </g>
    </svg>
  );
}

function ActiveChevron({ visible }: { visible: boolean }) {
  return <span className={`absolute right-3 text-[color:var(--blue-500)] transition-opacity duration-150 ${visible ? 'opacity-100' : 'opacity-0'}`} aria-hidden={!visible}>&gt;</span>;
}

const expandedRowClass = 'relative w-full items-center gap-2 px-2.5 pr-6';

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
    <div className="pointer-events-none fixed bottom-0 left-0 top-0 z-40 flex">
      <aside
        className={`pointer-events-auto h-full ${COLLAPSED_WIDTH} overflow-hidden border-r border-[color:var(--semantic-info-border)] bg-slate-50/90 shadow-sm transition-[width] duration-300 ease-out ${isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH}`}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
      >
        <div className="flex h-full flex-col px-2 pb-4 pt-7">
          <Link
            href="/admin"
            prefetch={false}
            onMouseEnter={() => router.prefetch('/admin')}
            onFocus={() => router.prefetch('/admin')}
            className={`mb-12 flex -translate-y-3 rounded-xl py-1.5 text-sm transition-colors duration-200 ${expandedRowClass} text-slate-900 hover:bg-[color:var(--hover-neutral)] hover:text-[color:var(--blue-500)] focus-visible:text-[color:var(--blue-500)]`}
            aria-label="Atehna administracija"
          >
            <span className={sidebarLogoIconWrapperClassName}>
              <AtehnaMarkIcon className={sidebarLogoIconClassName} />
            </span>
            <span className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ${isExpanded ? 'max-w-[11.5rem] opacity-100' : 'pointer-events-none max-w-0 opacity-0'}`} aria-hidden={!isExpanded}>
              Atehna
            </span>
          </Link>

          <nav className="space-y-1">
            {primaryLinks.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
              const SidebarIconComponent = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  prefetch={false}
                  onMouseEnter={() => router.prefetch(link.href)}
                  onFocus={() => router.prefetch(link.href)}
                  className={`flex rounded-xl py-1.5 text-sm transition-colors duration-200 ${expandedRowClass} ${
                    isActive
                      ? 'bg-[color:var(--hover-neutral)] font-semibold text-[color:var(--blue-500)]'
                      : 'text-slate-900 hover:bg-[color:var(--hover-neutral)] hover:text-[color:var(--blue-500)] focus-visible:text-[color:var(--blue-500)]'
                  }`}
                >
                  <span className={sidebarIconWrapperClassName}>
                    <SidebarIconComponent className={sidebarIconClassName} />
                  </span>
                  <span className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ${isExpanded ? 'max-w-[11.5rem] opacity-100' : 'pointer-events-none max-w-0 opacity-0'}`} aria-hidden={!isExpanded}>
                    {link.label}
                  </span>
                  <ActiveChevron visible={isExpanded && isActive} />
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto space-y-1">
            {bottomLinks.map((link) => {
              const isActive = pathname === '/';
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  prefetch={false}
                  onMouseEnter={() => router.prefetch(link.href)}
                  onFocus={() => router.prefetch(link.href)}
                  className={`flex rounded-xl py-1.5 text-sm transition-colors duration-200 ${expandedRowClass} ${
                    isActive
                      ? 'bg-[color:var(--hover-neutral)] font-semibold text-[color:var(--blue-500)]'
                      : 'text-slate-900 hover:bg-[color:var(--hover-neutral)] hover:text-[color:var(--blue-500)] focus-visible:text-[color:var(--blue-500)]'
                  }`}
                >
                  <span className={sidebarIconWrapperClassName}>
                    <SidebarIcon type={link.icon} />
                  </span>
                  <span className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ${isExpanded ? 'max-w-[11.5rem] opacity-100' : 'pointer-events-none max-w-0 opacity-0'}`} aria-hidden={!isExpanded}>
                    {link.label}
                  </span>
                  <ActiveChevron visible={isExpanded && isActive} />
                </Link>
              );
            })}

            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={isLoggingOut}
              className={`flex rounded-xl py-1.5 text-sm transition-colors duration-200 disabled:opacity-60 ${expandedRowClass} text-slate-900 hover:bg-[color:var(--hover-neutral)] hover:text-[color:var(--blue-500)] focus-visible:text-[color:var(--blue-500)]`}
            >
              <span className={sidebarIconWrapperClassName}>
                <SidebarIcon type="logout" />
              </span>
              <span className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ${isExpanded ? 'max-w-[11.5rem] opacity-100' : 'pointer-events-none max-w-0 opacity-0'}`} aria-hidden={!isExpanded}>
                {isLoggingOut ? <span className="inline-flex items-center gap-1.5"><Spinner size="sm" className="text-slate-500" />Odjava ...</span> : 'Odjava'}
              </span>
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
