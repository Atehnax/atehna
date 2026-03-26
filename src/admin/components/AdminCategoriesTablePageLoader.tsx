'use client';

import dynamic from 'next/dynamic';
import { AdminCategoriesRouteSkeleton } from '@/admin/components/AdminPageSkeletons';
import type { AdminCategoriesPayload } from '@/admin/features/kategorije/common/types';
import { useProgressiveActivation } from '@/shared/ui/useProgressiveActivation';

const LazyAdminCategoriesTablePageClient = dynamic(
  () => import('@/admin/features/kategorije/components/AdminCategoriesTablePageClient'),
  {
    ssr: false,
    loading: () => <AdminCategoriesRouteSkeleton initialView="table" />
  }
);

export default function AdminCategoriesTablePageLoader({ initialPayload }: { initialPayload: AdminCategoriesPayload }) {
  const { isActive, activate } = useProgressiveActivation();

  return (
    <div onPointerDownCapture={activate} onFocusCapture={activate}>
      {isActive ? <LazyAdminCategoriesTablePageClient initialPayload={initialPayload} /> : <AdminCategoriesRouteSkeleton initialView="table" />}
    </div>
  );
}
