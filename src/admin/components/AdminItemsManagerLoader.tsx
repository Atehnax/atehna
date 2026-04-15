import AdminItemsManager from '@/admin/features/artikli/components/AdminItemsManager';
import type { AdminCatalogListItem } from '@/shared/server/catalogItems';

export default function AdminItemsManagerLoader({ items }: { items: AdminCatalogListItem[] }) {
  return <AdminItemsManager items={items} />;
}
