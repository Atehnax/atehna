'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { AdminCategoriesRouteSkeleton } from '@/admin/components/AdminPageSkeletons';
import type { AdminCategoriesPayload } from '@/admin/features/kategorije/common/types';

const LazyAdminCategoriesTablePageClient = dynamic(
  () => import('@/admin/features/kategorije/components/AdminCategoriesTablePageClient'),
  {
    ssr: false,
    loading: () => <AdminCategoriesRouteSkeleton initialView="table" />
  }
);

export default function AdminCategoriesTablePageLoader({ initialPayload }: { initialPayload: AdminCategoriesPayload }) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsReady(true), 220);
    return () => window.clearTimeout(timer);
  }, []);

  if (!isReady) {
    return <AdminCategoriesRouteSkeleton initialView="table" />;
  }

  return <LazyAdminCategoriesTablePageClient initialPayload={initialPayload} />;
}
