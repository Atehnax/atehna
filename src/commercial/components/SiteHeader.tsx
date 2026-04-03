'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { EuiFieldText } from '@elastic/eui';
import { buttonTokenClasses } from '@/shared/ui/theme/tokens';

function CatalogSearchShell() {
  return (
    <div className="relative">
      <EuiFieldText
        type="search"
        disabled
        readOnly
        value=""
        aria-label="Poiščite izdelek..."
        placeholder="Poiščite izdelek..."
        className="w-full rounded-full border border-slate-300 bg-white px-4 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
    </div>
  );
}

function CartButtonShell() {
  return (
    <button
      type="button"
      disabled
      className={`relative ${buttonTokenClasses.outline} px-4 py-2`}
    >
      <span>Košarica</span>
      <span className="ml-2 text-xs font-semibold text-slate-500 opacity-0">0,00&nbsp;€</span>
      <span className="ml-2 inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white opacity-0">
        0
      </span>
    </button>
  );
}

const ProgressiveCatalogSearch = dynamic(() => import('@/commercial/features/products/CatalogSearch'), {
  ssr: false,
  loading: () => <CatalogSearchShell />
});

const ProgressiveCartButton = dynamic(() => import('@/commercial/features/cart/CartButton'), {
  ssr: false,
  loading: () => <CartButtonShell />
});

const navItems = [
  { href: '/products', label: 'Izdelki' },
  { href: '/how-schools-order', label: 'Kako naročiti' },
  { href: '/about', label: 'O podjetju' },
  { href: '/contact', label: 'Kontakt' }
];

export default function SiteHeader() {
  const pathname = usePathname();
  const isAdminPath = pathname.startsWith('/admin');

  if (isAdminPath) {
    return (
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="container-base flex items-center gap-3 py-4">
          <Link href="/" prefetch={false} className="text-lg font-semibold tracking-tight text-slate-900">
            Atehna
            <span className="ml-2 text-sm font-medium text-brand-600">Šolska tehnika</span>
          </Link>
          <span className="rounded-full border border-[color:var(--semantic-info-border)] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--blue-500)]">
            Administracija
          </span>
        </div>
      </header>
    );
  }

  return (
    <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="container-base flex items-center gap-4 py-4">
        <Link href="/" prefetch={false} className="text-lg font-semibold tracking-tight text-slate-900">
          Atehna
          <span className="ml-2 text-sm font-medium text-brand-600">Šolska tehnika</span>
        </Link>
        <div className="flex-1">
          <ProgressiveCatalogSearch />
        </div>
        <div className="flex items-center gap-3">
          <details className="relative">
            <summary className="flex min-w-[120px] cursor-pointer list-none items-center justify-between gap-2 rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand-200">
              Meni
              <span className="text-slate-400">▾</span>
            </summary>
            <div className="absolute right-0 z-20 mt-2 w-48 rounded-2xl border border-slate-200 bg-white p-2 text-sm shadow-lg">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  className="block rounded-lg px-3 py-2 text-slate-700 transition hover:bg-[color:var(--hover-neutral)] hover:text-brand-600"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </details>
          <ProgressiveCartButton />
        </div>
      </div>
    </header>
  );
}
