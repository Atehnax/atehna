'use client';

import dynamic from 'next/dynamic';
import { AdminArchiveSectionSkeleton } from '@/admin/components/AdminPageSkeletons';
import { useProgressiveActivation } from '@/shared/ui/useProgressiveActivation';

const LazyAdminDeletedArchiveTable = dynamic(() => import('@/admin/components/AdminDeletedArchiveTable'), {
  ssr: false,
  loading: () => <AdminArchiveSectionSkeleton />
});

type ArchiveEntryTuple = readonly [id: number, itemType: 'order' | 'pdf', orderId: number | null, documentId: number | null, label: string, deletedAt: string, expiresAt: string];

export default function AdminDeletedArchiveTableLoader({ initialEntries }: { initialEntries: ArchiveEntryTuple[] }) {
  const { isActive, activate } = useProgressiveActivation();

  return (
    <div onPointerDownCapture={activate} onFocusCapture={activate}>
      {isActive ? <LazyAdminDeletedArchiveTable initialEntries={initialEntries} /> : <AdminArchiveSectionSkeleton />}
    </div>
  );
}
