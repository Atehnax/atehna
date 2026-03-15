import AdminCategoriesMainTable from '@/admin/features/kategorije/components/AdminCategoriesMainTable';
import { getCatalogDataFromDatabase } from '@/shared/server/catalogCategories';

export const dynamic = 'force-dynamic';

export default async function AdminCategoriesPage() {
  const payload = await getCatalogDataFromDatabase({ includeInactive: true, includeStatuses: true });
  return <AdminCategoriesMainTable initialView="table" initialPayload={payload} />;
}
