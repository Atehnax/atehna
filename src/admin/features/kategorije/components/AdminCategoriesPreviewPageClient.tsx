'use client';

import dynamic from 'next/dynamic';
import { AdminCategoriesPreviewContentSkeleton } from '@/admin/components/AdminPageSkeletons';
import type { AdminCategoriesPayload } from '@/admin/features/kategorije/common/types';

const AdminCategoriesMainTable = dynamic(
  () => import('@/admin/features/kategorije/components/AdminCategoriesMainTable'),
  { loading: () => <AdminCategoriesPreviewContentSkeleton /> }
);

export default function AdminCategoriesPreviewPageClient({ initialPayload }: { initialPayload: AdminCategoriesPayload }) {
  return <AdminCategoriesMainTable initialView="preview" initialPayload={initialPayload} />;
}
