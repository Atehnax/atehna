'use client';

import type { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { buttonTokenClasses } from '@/shared/ui/theme/tokens';

const AddToCartButton = dynamic(() => import('@/commercial/features/products/AddToCartButton'), {
  ssr: false,
  loading: () => (
    <button
      type="button"
      disabled
      className={`mt-4 w-full justify-center ${buttonTokenClasses.primary}`}
    >
      Dodaj v naročilo
    </button>
  )
});

export default function ProgressiveAddToCartButton(props: {
  sku: string;
  name: string;
  unit?: string;
  category?: string;
  unitPrice?: number;
  price?: number;
  className?: string;
  children?: ReactNode;
}) {
  return <AddToCartButton {...props} />;
}
