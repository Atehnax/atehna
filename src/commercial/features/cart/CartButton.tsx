'use client';

import { useEffect, useState } from 'react';
import { useCartStore } from '@/commercial/cart/store';

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

export default function CartButton() {
  const itemCount = useCartStore((state) => state.getItemCount());
  const openDrawer = useCartStore((state) => state.openDrawer);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const visibleCount = isMounted ? itemCount : 0;

  return (
    <button
      type="button"
      onClick={openDrawer}
      aria-label={`Košarica (${visibleCount})`}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-[#263348] transition hover:bg-[#f3f6fa] hover:text-[color:var(--blue-500)]"
    >
      <CartIcon />
      <span className="absolute right-0 top-0 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[color:var(--blue-500)] px-1 text-[10px] font-bold leading-none text-white">
        {visibleCount}
      </span>
    </button>
  );
}
