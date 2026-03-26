'use client';

import dynamic from 'next/dynamic';
import AdminCategoriesStaticShell from '@/admin/features/kategorije/components/AdminCategoriesStaticShell';
import type { AdminCategoriesPayload, CategoriesView } from '@/admin/features/kategorije/common/types';
import { useProgressiveActivation } from '@/shared/ui/useProgressiveActivation';

const LazyAdminCategoriesMainTable = dynamic(
  () => import('@/admin/features/kategorije/components/AdminCategoriesMainTable'),
  { ssr: false }
);

export default function AdminCategoriesProgressivePageClient({
  initialView,
  initialPayload
}: {
  initialView: CategoriesView;
  initialPayload: AdminCategoriesPayload;
}) {
  const { isActive, activate } = useProgressiveActivation();

  return (
    <div onPointerDownCapture={activate} onFocusCapture={activate}>
      {isActive ? (
        <LazyAdminCategoriesMainTable initialView={initialView} initialPayload={initialPayload} />
      ) : (
        <AdminCategoriesStaticShell initialView={initialView} />
      )}
    </div>
  );
}
