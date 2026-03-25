'use client';

import dynamic from 'next/dynamic';
import { AdminCategoriesMillerContentSkeleton } from '@/admin/components/AdminPageSkeletons';
import type { AdminCategoriesPayload } from '@/admin/features/kategorije/common/types';

const AdminCategoriesMainTable = dynamic(
  () => import('@/admin/features/kategorije/components/AdminCategoriesMainTable'),
  { loading: () => <AdminCategoriesMillerContentSkeleton /> }
);

export default function AdminCategoriesMillerPageClient({ initialPayload }: { initialPayload: AdminCategoriesPayload }) {
  return <AdminCategoriesMainTable initialView="miller" initialPayload={initialPayload} />;
}
