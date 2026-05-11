'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import AtehnaLogo from '@/commercial/components/AtehnaLogo';

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none">
      <path
        d="m20 20-4.4-4.4m2.4-5.1a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AccountIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none">
      <path
        d="M12 12.3a4.3 4.3 0 1 0 0-8.6 4.3 4.3 0 0 0 0 8.6Zm-7.2 8c.7-3.4 3.4-5.4 7.2-5.4s6.5 2 7.2 5.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7" fill="none">
      <path
        d="M3.5 4.8h2.2l1.8 10.1h9.7l2-7.1H7.2m1 10.8h.1m8.2 0h.1"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.2 19.4a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8Zm8.3 0a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8Z"
        fill="currentColor"
      />
    </svg>
  );
}

function HeaderIconLink({
  href,
  label,
  children
}: {
  href: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      aria-label={label}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#263348] transition hover:bg-[#f3f6fa] hover:text-[color:var(--blue-500)]"
    >
      {children}
    </Link>
  );
}

function CartButtonShell() {
  return (
    <button
      type="button"
      disabled
      aria-label="Košarica"
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-[#263348]"
    >
      <CartIcon />
      <span className="absolute right-0 top-0 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[color:var(--blue-500)] px-1 text-[10px] font-bold leading-none text-white">
        0
      </span>
    </button>
  );
}

const ProgressiveCartButton = dynamic(() => import('@/commercial/features/cart/CartButton'), {
  ssr: false,
  loading: () => <CartButtonShell />
});

const navItems = [
  { href: '/products', label: 'Izdelki' },
  { href: '/about', label: 'O nas' },
  { href: '/contact', label: 'Kontakt' }
];

export default function SiteHeader() {
  const pathname = usePathname();
  const isAdminPath = pathname.startsWith('/admin');

  if (isAdminPath) {
    return (
      <header className="border-b border-[#dde4ed] bg-white">
        <div className="mx-auto flex h-[72px] max-w-[1840px] items-center px-5 sm:px-8 lg:px-16">
          <Link href="/" prefetch={false} aria-label="Atehna domov">
            <AtehnaLogo />
          </Link>
        </div>
      </header>
    );
  }

  return (
    <header className="border-b border-[#dde4ed] bg-white">
      <div className="mx-auto flex h-[72px] max-w-[1840px] items-center justify-between gap-4 px-5 sm:h-[82px] sm:px-8 lg:px-16">
        <Link href="/" prefetch={false} aria-label="Atehna domov" className="shrink-0">
          <AtehnaLogo />
        </Link>

        <div className="flex items-center gap-3 sm:gap-7">
          <HeaderIconLink href="/products" label="Iskanje">
            <SearchIcon />
          </HeaderIconLink>

          <span className="hidden h-7 w-px bg-[#e1e7ef] sm:block" />

          <nav aria-label="Glavna navigacija" className="hidden items-center gap-10 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                className="text-base font-medium text-[#05070a] transition hover:text-[color:var(--blue-500)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <span className="hidden h-7 w-px bg-[#e1e7ef] sm:block" />

          <HeaderIconLink href="/order" label="Račun">
            <AccountIcon />
          </HeaderIconLink>
          <ProgressiveCartButton />
        </div>
      </div>
    </header>
  );
}
