'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { AdminOrderDocumentsSectionSkeleton } from '@/admin/components/AdminPageSkeletons';
import type { PersistedOrderPdfDocument } from '@/shared/domain/order/orderTypes';

const AdminOrderPdfManager = dynamic(() => import('@/admin/components/AdminOrderPdfManager'), {
  ssr: false,
  loading: () => <AdminOrderDocumentsSectionSkeleton />
});

export default function AdminOrderPdfManagerClient(props: {
  orderId: number;
  documents: PersistedOrderPdfDocument[];
  adminNotesSlot?: ReactNode;
}) {
  return <AdminOrderPdfManager {...props} />;
}
