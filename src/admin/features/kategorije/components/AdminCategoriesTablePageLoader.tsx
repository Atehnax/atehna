import AdminCategoriesTablePageClient from '@/admin/features/kategorije/components/AdminCategoriesTablePageClient';
import type { AdminCategoriesPayload } from '@/admin/features/kategorije/common/types';

export default function AdminCategoriesTablePageLoader({ initialPayload }: { initialPayload: AdminCategoriesPayload }) {
  return <AdminCategoriesTablePageClient initialPayload={initialPayload} />;
}
