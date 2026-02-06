'use client';

import type { ReactNode } from 'react';
import { useCartStore } from '@/lib/cart/store';

type AddToCartButtonProps = {
  sku: string;
  name: string;
  unit?: string;
  category?: string;
  price?: number;
  className?: string;
  children?: ReactNode;
};

export default function AddToCartButton({
  sku,
  name,
  unit,
  category,
  price,
  className = '',
  children
}: AddToCartButtonProps) {
  const addItem = useCartStore((state) => state.addItem);
  const openDrawer = useCartStore((state) => state.openDrawer);

  return (
    <button
      type="button"
      onClick={() => {
        addItem({ sku, name, unit, category, price });
        openDrawer();
      }}
      className={`rounded-full bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700 ${className}`}
    >
      {children ?? 'Dodaj v naročilo'}
    </button>
  );
}
