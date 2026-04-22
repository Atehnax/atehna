'use client';

import dynamic from 'next/dynamic';
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
  paymentStatus?: string | null;
  adminOrderNotes?: string | null;
}) {
  return <AdminOrderPdfManager {...props} />;
}
