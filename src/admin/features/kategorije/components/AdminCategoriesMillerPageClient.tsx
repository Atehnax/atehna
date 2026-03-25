'use client';

import AdminCategoriesMainTable from '@/admin/features/kategorije/components/AdminCategoriesMainTable';
import type { AdminCategoriesPayload } from '@/admin/features/kategorije/common/types';

export default function AdminCategoriesMillerPageClient({ initialPayload }: { initialPayload: AdminCategoriesPayload }) {
  return <AdminCategoriesMainTable initialView="miller" initialPayload={initialPayload} />;
}
