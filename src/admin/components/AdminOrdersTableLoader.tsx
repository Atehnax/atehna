'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { AdminOrdersSectionSkeleton } from '@/admin/components/AdminPageSkeletons';
import type { AnalyticsGlobalAppearance } from '@/shared/server/analyticsCharts';

const LazyAdminOrdersTable = dynamic(() => import('@/admin/components/AdminOrdersTable'), {
  ssr: false,
  loading: () => <AdminOrdersSectionSkeleton />
});

type OrderRowTuple = readonly [
  id: number,
  orderNumber: string,
  customerType: string,
  organizationName: string | null,
  contactName: string,
  email: string,
  phone: string | null,
  deliveryAddress: string | null,
  reference: string | null,
  notes: string | null,
  status: string,
  paymentStatus: string | null,
  paymentNotes: string | null,
  subtotal: number | string | null,
  tax: number | string | null,
  total: number | string | null,
  createdAt: string,
  isDraft: boolean,
  deletedAt?: string | null
];
type PdfDocTuple = readonly [id: number, orderId: number, type: string, filename: string, blobUrl: string, createdAt: string];
type AttachmentTuple = readonly [id: number, orderId: number, type: string, filename: string, blobUrl: string, createdAt?: string];

export default function AdminOrdersTableLoader(props: {
  orders: ReadonlyArray<Readonly<OrderRowTuple>>;
  documents: ReadonlyArray<PdfDocTuple>;
  attachments: ReadonlyArray<AttachmentTuple>;
  initialFrom?: string;
  initialTo?: string;
  initialQuery?: string;
  initialStatusFilter?: string;
  initialDocumentType?: string;
  initialPage?: number;
  initialPageSize?: number;
  totalCount?: number;
  topAction?: React.ReactNode;
  analyticsAppearance?: AnalyticsGlobalAppearance;
}) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsReady(true), 220);
    return () => window.clearTimeout(timer);
  }, []);

  if (!isReady) {
    return <AdminOrdersSectionSkeleton />;
  }

  return <LazyAdminOrdersTable {...props} />;
}
