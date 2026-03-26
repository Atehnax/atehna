'use client';

import AdminCategoriesProgressivePageClient from '@/admin/features/kategorije/components/AdminCategoriesProgressivePageClient';
import type { AdminCategoriesPayload } from '@/admin/features/kategorije/common/types';

export default function AdminCategoriesPreviewPageClient({ initialPayload }: { initialPayload: AdminCategoriesPayload }) {
  return <AdminCategoriesProgressivePageClient initialView="preview" initialPayload={initialPayload} />;
}
