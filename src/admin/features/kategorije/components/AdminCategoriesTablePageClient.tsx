'use client';

import dynamic from 'next/dynamic';
import { AdminCategoriesTableContentSkeleton } from '@/admin/components/AdminPageSkeletons';
import type { AdminCategoriesPayload } from '@/admin/features/kategorije/common/types';

const AdminCategoriesMainTable = dynamic(
  () => import('@/admin/features/kategorije/components/AdminCategoriesMainTable'),
  { loading: () => <AdminCategoriesTableContentSkeleton /> }
);

export default function AdminCategoriesTablePageClient({ initialPayload }: { initialPayload: AdminCategoriesPayload }) {
  return <AdminCategoriesMainTable initialView="table" initialPayload={initialPayload} />;
}
