'use client';

import { useEffect, useState } from 'react';
import PaymentChip from '@/components/admin/PaymentChip';
import StatusChip from '@/components/admin/StatusChip';

type Props = {
  orderNumber: string;
  status: string;
  paymentStatus?: string | null;
};

export default function AdminOrderHeaderChips({ orderNumber, status, paymentStatus }: Props) {
  const [currentStatus, setCurrentStatus] = useState(status);
  const [currentPaymentStatus, setCurrentPaymentStatus] = useState(paymentStatus ?? null);

  useEffect(() => {
    const onStatusUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ status?: string; paymentStatus?: string | null }>;
      if (customEvent.detail?.status) setCurrentStatus(customEvent.detail.status);
      if (customEvent.detail?.paymentStatus !== undefined) {
        setCurrentPaymentStatus(customEvent.detail.paymentStatus ?? null);
      }
    };

    window.addEventListener('admin-order-status-updated', onStatusUpdated as EventListener);
    return () =>
      window.removeEventListener('admin-order-status-updated', onStatusUpdated as EventListener);
  }, []);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-gradient-to-r from-white to-slate-50 px-4 py-3 shadow-sm">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{orderNumber}</h1>
      <div className="flex items-center gap-1">
        <StatusChip status={currentStatus} />
        <PaymentChip status={currentPaymentStatus} />
      </div>
    </div>
  );
}
