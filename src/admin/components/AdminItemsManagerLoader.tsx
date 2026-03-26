'use client';

import dynamic from 'next/dynamic';
import { AdminItemsSectionSkeleton } from '@/admin/components/AdminPageSkeletons';
import { useProgressiveActivation } from '@/shared/ui/useProgressiveActivation';

const LazyAdminItemsManager = dynamic(() => import('@/admin/features/artikli/components/AdminItemsManager'), {
  ssr: false,
  loading: () => <AdminItemsSectionSkeleton />
});

type SeedItemTuple = [
  id: string,
  name: string,
  description: string,
  category: string,
  categoryId: string,
  subcategoryId: string | null,
  price: number,
  sku: string,
  images: string[],
  discountPct: number,
  displayOrder: number | null
];

export default function AdminItemsManagerLoader({ seedItems }: { seedItems: SeedItemTuple[] }) {
  const { isActive, activate } = useProgressiveActivation();

  return (
    <div onPointerDownCapture={activate} onFocusCapture={activate}>
      {isActive ? <LazyAdminItemsManager seedItems={seedItems} /> : <AdminItemsSectionSkeleton />}
    </div>
  );
}
