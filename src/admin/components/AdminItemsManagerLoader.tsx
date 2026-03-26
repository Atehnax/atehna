'use client';

import dynamic from 'next/dynamic';

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

const LazyAdminItemsManager = dynamic(() => import('@/admin/features/artikli/components/AdminItemsManager'));

export default function AdminItemsManagerLoader({ seedItems }: { seedItems: SeedItemTuple[] }) {
  return <LazyAdminItemsManager seedItems={seedItems} />;
}
