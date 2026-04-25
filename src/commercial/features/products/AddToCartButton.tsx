'use client';

import type { ReactNode } from 'react';
import { useCartStore } from '@/commercial/cart/store';
import { Button } from '@/shared/ui/button';

type AddToCartButtonProps = {
  sku: string;
  name: string;
  unit?: string;
  category?: string;
  unitPrice?: number;
  className?: string;
  children?: ReactNode;
};

export default function AddToCartButton({
  sku,
  name,
  unit,
  category,
  unitPrice,
  className = '',
  children
}: AddToCartButtonProps) {
  const addItem = useCartStore((state) => state.addItem);
  const openDrawer = useCartStore((state) => state.openDrawer);

  return (
    <Button
      type="button"
      variant="primary"
      size="sm"
      onClick={() => {
        addItem({ sku, name, unit, category, unitPrice });
        openDrawer();
      }}
      className={className}
    >
      {children ?? 'Dodaj v naročilo'}
    </Button>
  );
}
