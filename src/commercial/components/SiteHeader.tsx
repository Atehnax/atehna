import Link from 'next/link';
import dynamic from 'next/dynamic';

const ProgressiveCatalogSearch = dynamic(() => import('@/commercial/features/products/CatalogSearch'), {
  ssr: false,
  loading: () => (
    <div className="w-full rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-400 shadow-sm">
      Poiščite izdelek...
    </div>
  )
});

const ProgressiveCartButton = dynamic(() => import('@/commercial/features/cart/CartButton'), {
  ssr: false,
  loading: () => (
    <button
      type="button"
      disabled
      className="relative rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
    >
      <span>Košarica</span>
    </button>
  )
});

const navItems = [
  { href: '/products', label: 'Izdelki' },
  { href: '/how-schools-order', label: 'Kako naročiti' },
  { href: '/about', label: 'O podjetju' },
  { href: '/contact', label: 'Kontakt' }
];

export default function SiteHeader() {
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
