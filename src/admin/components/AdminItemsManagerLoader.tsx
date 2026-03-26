'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { AdminItemsSectionSkeleton } from '@/admin/components/AdminPageSkeletons';

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
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsReady(true), 220);
    return () => window.clearTimeout(timer);
  }, []);

  if (!isReady) {
    return <AdminItemsSectionSkeleton />;
  }

  return <LazyAdminItemsManager seedItems={seedItems} />;
}
