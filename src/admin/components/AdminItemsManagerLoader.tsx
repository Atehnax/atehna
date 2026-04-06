import AdminItemsManager from '@/admin/features/artikli/components/AdminItemsManager';
import type { SeedItemTuple } from '@/admin/features/artikli/lib/familyModel';

export default function AdminItemsManagerLoader({ seedItems }: { seedItems: SeedItemTuple[] }) {
  return <AdminItemsManager seedItems={seedItems} />;
}
