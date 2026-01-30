'use client';

import Link from 'next/link';
import CartButton from '@/components/cart/CartButton';

const navItems = [
  { href: '/products', label: 'Izdelki' },
  { href: '/how-schools-order', label: 'Kako šole naročajo' },
  { href: '/about', label: 'O podjetju' },
  { href: '/contact', label: 'Kontakt' }
];

export default function SiteHeader() {
  return (
    <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="container-base flex items-center justify-between py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900">
          Atehna
          <span className="ml-2 text-sm font-medium text-brand-600">Šolska tehnika</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-700 md:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="transition hover:text-brand-600">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <CartButton />
          <Link
            href="/contact"
            className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            Kontakt
          </Link>
        </div>
      </div>
    </header>
  );
}
