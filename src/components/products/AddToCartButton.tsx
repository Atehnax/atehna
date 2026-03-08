'use client';

import type { ReactNode } from 'react';
import { useCartStore } from '@/lib/cart/store';
import { Button } from '@/shared/ui/button';

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
    <Button
      type="button"
      variant="brand"
      size="sm"
      onClick={() => {
        addItem({ sku, name, unit, category, unitPrice: resolvedUnitPrice });
        openDrawer();
      }}
      className={className}
    >
      {children ?? 'Dodaj v naročilo'}
    </Button>
  );
}
