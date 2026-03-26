import AdminItemsManager from '@/admin/features/artikli/components/AdminItemsManager';

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
  return <AdminItemsManager seedItems={seedItems} />;
}
