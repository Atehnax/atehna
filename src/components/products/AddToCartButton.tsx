'use client';

import type { ReactNode } from 'react';
import { useCartStore } from '@/lib/cart/store';

type AddToCartButtonProps = {
  sku: string;
  name: string;
  unit?: string;
  category?: string;
  unitPrice?: number;
  price?: number; // legacy fallback
  className?: string;
  children?: ReactNode;
};

export default function AddToCartButton({
  sku,
  name,
  unit,
  category,
  unitPrice,
  price,
  className = '',
  children
}: AddToCartButtonProps) {
  const addItem = useCartStore((state) => state.addItem);
  const openDrawer = useCartStore((state) => state.openDrawer);

  const resolvedUnitPrice = unitPrice ?? price;

  return (
    <button
      type="button"
      onClick={() => {
        addItem({ sku, name, unit, category, unitPrice: resolvedUnitPrice });
        openDrawer();
      }}
      className={`rounded-full bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700 ${className}`}
    >
      {children ?? 'Dodaj v naročilo'}
    </button>
  );
}
