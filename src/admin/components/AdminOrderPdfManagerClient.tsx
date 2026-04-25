'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { AdminOrderDocumentsSectionSkeleton } from '@/admin/components/AdminPageSkeletons';

type PdfDocument = {
  id: number;
  type: string;
  filename: string;
  blob_url: string;
  created_at: string;
};

const AdminOrderPdfManager = dynamic(() => import('@/admin/components/AdminOrderPdfManager'), {
  ssr: false,
  loading: () => <AdminOrderDocumentsSectionSkeleton />
});

export default function AdminOrderPdfManagerClient(props: {
  orderId: number;
  documents: PdfDocument[];
  adminNotesSlot?: ReactNode;
}) {
  return <AdminOrderPdfManager {...props} />;
}
