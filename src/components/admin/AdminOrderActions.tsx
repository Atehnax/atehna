'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ORDER_STATUS_OPTIONS } from '@/lib/orderStatus';
import { PAYMENT_STATUS_OPTIONS, isPaymentStatus } from '@/lib/paymentStatus';

type Props = {
  orderId: number;
  status: string;
  paymentStatus?: string | null;
  paymentNotes?: string | null;
};

export default function AdminOrderActions({
  orderId,
  status,
  paymentStatus,
  paymentNotes
}: Props) {
  const router = useRouter();
  const [currentStatus, setCurrentStatus] = useState(status);
  const [currentPaymentStatus, setCurrentPaymentStatus] = useState<string>(
    isPaymentStatus(paymentStatus ?? '') ? paymentStatus ?? 'unpaid' : 'unpaid'
  );
  const [currentPaymentNote, setCurrentPaymentNote] = useState<string>(paymentNotes ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const updateStatus = async () => {
    setIsWorking(true);
    setMessage(null);
    try {
      const [statusResponse, paymentResponse] = await Promise.all([
        fetch(`/api/admin/orders/${orderId}/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: currentStatus })
        }),
        fetch(`/api/admin/orders/${orderId}/payment-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: currentPaymentStatus, note: currentPaymentNote })
        })
      ]);

      if (!statusResponse.ok) {
        const error = await statusResponse.json().catch(() => ({}));
        throw new Error(error.message || 'Posodobitev statusa naročila ni uspela.');
      }

      if (!paymentResponse.ok) {
        const error = await paymentResponse.json().catch(() => ({}));
        throw new Error(error.message || 'Posodobitev plačilnega statusa ni uspela.');
      }

      setMessage('Status naročila in plačila je posodobljen.');
      window.dispatchEvent(
        new CustomEvent('admin-order-status-updated', {
          detail: { status: currentStatus, paymentStatus: currentPaymentStatus }
        })
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Napaka pri posodobitvi statusov.');
    } finally {
      setIsWorking(false);
    }
  };

  const deleteOrder = async () => {
    const confirmed = window.confirm('Ali ste prepričani, da želite izbrisati to naročilo?');
    if (!confirmed) return;
    setIsDeleting(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Brisanje ni uspelo.');
      }
      setMessage('Naročilo je izbrisano.');
      router.push('/admin/orders');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Napaka pri brisanju naročila.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Status naročila</h2>
      <div className="mt-4 space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
          <label className="text-xs font-medium text-slate-700" htmlFor="status">
            Status naročila
          </label>
            <select
              id="status"
              value={currentStatus}
              onChange={(event) => setCurrentStatus(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[12px]"
            >
              {ORDER_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
              <label className="text-xs font-medium text-slate-700" htmlFor="paymentStatus">
                Status plačila
              </label>
              <select
                id="paymentStatus"
                value={currentPaymentStatus}
                onChange={(event) => setCurrentPaymentStatus(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-[12px]"
              >
                {PAYMENT_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-700" htmlFor="paymentNote">
            Opombe plačila
          </label>
          <textarea
            id="paymentNote"
            rows={2}
            value={currentPaymentNote ?? ""}
            onChange={(event) => setCurrentPaymentNote(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-[12px]"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={updateStatus}
            disabled={isWorking}
            className="w-1/2 whitespace-nowrap rounded-full bg-brand-600 px-4 py-2 text-[12px] font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            Shrani status
          </button>
          <button
            type="button"
            onClick={deleteOrder}
            disabled={isDeleting}
            className="w-1/2 whitespace-nowrap rounded-full border border-red-200 px-4 py-2 text-[12px] font-semibold text-red-600 transition hover:border-red-300 hover:text-red-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
          >
            {isDeleting ? 'Brisanje...' : 'Izbriši naročilo'}
          </button>
        </div>

        {message && <p className="text-sm text-slate-600">{message}</p>}
      </div>
    </div>
  );
}
