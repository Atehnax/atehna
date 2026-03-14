import AdminCategoriesManager from '@/admin/features/kategorije/components/AdminCategoriesManager';
import { getCatalogDataFromDatabase } from '@/shared/server/catalogCategories';

export const dynamic = 'force-dynamic';

export default async function AdminCategoriesMillerPage() {
  const payload = await getCatalogDataFromDatabase({ includeInactive: true, includeStatuses: true });
  return <AdminCategoriesManager initialView="miller" initialPayload={payload} />;
}
