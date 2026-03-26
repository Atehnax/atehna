'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { AdminArchiveSectionSkeleton } from '@/admin/components/AdminPageSkeletons';

const LazyAdminDeletedArchiveTable = dynamic(() => import('@/admin/components/AdminDeletedArchiveTable'), {
  ssr: false,
  loading: () => <AdminArchiveSectionSkeleton />
});

type ArchiveEntryTuple = readonly [id: number, itemType: 'order' | 'pdf', orderId: number | null, documentId: number | null, label: string, deletedAt: string, expiresAt: string];

export default function AdminDeletedArchiveTableLoader({ initialEntries }: { initialEntries: ArchiveEntryTuple[] }) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsReady(true), 220);
    return () => window.clearTimeout(timer);
  }, []);

  if (!isReady) {
    return <AdminArchiveSectionSkeleton />;
  }

  return <LazyAdminDeletedArchiveTable initialEntries={initialEntries} />;
}
