'use client';

import AdminCategoriesMainTable from '@/admin/features/kategorije/components/AdminCategoriesMainTable';
import type { AdminCategoriesPayload } from '@/admin/features/kategorije/common/types';

export default function AdminCategoriesPreviewPageClient({ initialPayload }: { initialPayload: AdminCategoriesPayload }) {
  return <AdminCategoriesMainTable initialView="preview" initialPayload={initialPayload} />;
}
