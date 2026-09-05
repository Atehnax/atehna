'use client';

import type { ReactNode } from 'react';
import { useCartStore } from '@/commercial/cart/store';
import type { AddCartItemInput } from '@/commercial/cart/cartTypes';
import { Button } from '@/shared/ui/button';

type AddToCartButtonProps = {
  item?: AddCartItemInput;
  sku?: string;
  name?: string;
  unit?: string;
  category?: string;
  unitPrice?: number;
  quantity?: number;
  resolveQuantity?: () => number | null;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
};

export default function AddToCartButton({
  item,
  sku,
  name,
  unit,
  category,
  unitPrice,
  quantity,
  resolveQuantity,
  disabled = false,
  className = '',
  children
}: AddToCartButtonProps) {
  const addItem = useCartStore((state) => state.addItem);
  const openDrawer = useCartStore((state) => state.openDrawer);
  const resolvedItem: AddCartItemInput | null =
    item ??
    (sku && name
      ? {
          sku,
          name,
          unit,
          category,
          unitPrice,
          reconciliation: {
            status: 'needs_review',
            message: 'Pred oddajo ponovno izberite različico artikla.'
          }
        }
      : null);

  return (
    <Button
      type="button"
      variant="primary"
      size="sm"
      disabled={disabled || resolvedItem === null}
      onClick={() => {
        if (!resolvedItem) return;
        const submittedQuantity = resolveQuantity
          ? resolveQuantity()
          : quantity ?? resolvedItem.reconciliation?.minOrder ?? 1;
        if (submittedQuantity === null) return;
        addItem({ ...resolvedItem, quantity: submittedQuantity });
        openDrawer();
      }}
      className={className}
    >
      {children ?? 'Dodaj v košarico'}
    </Button>
  );
}
