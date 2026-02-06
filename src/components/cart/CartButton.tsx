'use client';

import { useEffect, useState } from 'react';
import { useCartStore } from '@/lib/cart/store';

export default function CartButton() {
  const items = useCartStore((state) => state.items);
  const itemCount = useCartStore((state) => state.getItemCount());
  const openDrawer = useCartStore((state) => state.openDrawer);
  const [isMounted, setIsMounted] = useState(false);
  const total = items.reduce(
    (sum, item) => sum + (item.unitPrice ?? 0) * item.quantity,
    0
  );
  const formattedTotal = new Intl.NumberFormat('sl-SI', {
    style: 'currency',
    currency: 'EUR'
  }).format(total);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <button
      type="button"
      onClick={openDrawer}
      className="relative rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand-200 hover:text-brand-600"
    >
      <span>Košarica</span>
      {isMounted && itemCount > 0 && (
        <>
          <span className="ml-2 text-xs font-semibold text-slate-500">{formattedTotal}</span>
          <span className="ml-2 inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white">
            {itemCount}
          </span>
        </>
      )}
    </button>
  );
}
