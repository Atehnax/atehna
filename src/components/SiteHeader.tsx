'use client';

import Link from 'next/link';
import CartButton from '@/components/cart/CartButton';
import ItemSearch from '@/components/products/ItemSearch';
import type { CatalogSearchItem } from '@/lib/catalog';

const navItems = [
  { href: '/products', label: 'Izdelki' },
  { href: '/how-schools-order', label: 'Kako naročiti' },
  { href: '/about', label: 'O podjetju' },
  { href: '/contact', label: 'Kontakt' }
];

type SiteHeaderProps = {
  searchItems: CatalogSearchItem[];
};

export default function SiteHeader({ searchItems }: SiteHeaderProps) {
  return (
    <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="container-base flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
        <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900">
          Atehna
          <span className="ml-2 text-sm font-medium text-brand-600">Šolska tehnika</span>
        </Link>
        <div className="w-full max-w-2xl md:mx-6">
          <ItemSearch items={searchItems} />
        </div>
        <div className="flex items-center gap-3 md:ml-auto">
          <details className="relative">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand-200">
              Meni
              <span className="text-slate-400">▾</span>
            </summary>
            <div className="absolute right-0 z-20 mt-2 w-48 rounded-2xl border border-slate-200 bg-white p-2 text-sm shadow-lg">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-lg px-3 py-2 text-slate-700 transition hover:bg-slate-50 hover:text-brand-600"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </details>
          <CartButton />
        </div>
      </div>
    </header>
  );
}
