'use client';

import dynamic from 'next/dynamic';

type ArchiveEntryTuple = readonly [id: number, itemType: 'order' | 'pdf', orderId: number | null, documentId: number | null, label: string, deletedAt: string, expiresAt: string];

const LazyAdminDeletedArchiveTable = dynamic(() => import('@/admin/components/AdminDeletedArchiveTable'));

export default function AdminDeletedArchiveTableLoader({ initialEntries }: { initialEntries: ArchiveEntryTuple[] }) {
  return <LazyAdminDeletedArchiveTable initialEntries={initialEntries} />;
}
