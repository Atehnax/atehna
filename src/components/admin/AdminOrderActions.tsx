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


const isFilled = (value: unknown) => typeof value === 'string' && value.trim().length > 0;

type FloatingTextareaProps = {
  id: string;
  label: string;
  value: string;
  rows?: number;
  onChange: (value: string) => void;
};

function FloatingTextarea({ id, label, value, rows = 2, onChange }: FloatingTextareaProps) {
  return (
    <div className="group relative" data-filled={isFilled(value) ? 'true' : 'false'}>
      <textarea
        id={id}
        rows={rows}
        value={value}
        placeholder=" "
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 pb-2 pt-5 text-[12px] text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      />
      <label
        htmlFor={id}
        className="pointer-events-none absolute left-3 top-5 -translate-y-1/2 text-[12px] text-slate-400 transition-all duration-150 group-focus-within:top-1.5 group-focus-within:translate-y-0 group-focus-within:bg-white group-focus-within:px-1 group-focus-within:text-[10px] group-focus-within:text-slate-600 group-data-[filled=true]:top-1.5 group-data-[filled=true]:translate-y-0 group-data-[filled=true]:bg-white group-data-[filled=true]:px-1 group-data-[filled=true]:text-[10px] group-data-[filled=true]:text-slate-600"
      >
        {label}
      </label>
    </div>
  );
}

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
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

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

  const deleteOrder = () => {
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteOrder = async () => {
    setIsDeleting(true);
    setIsDeleteModalOpen(false);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Brisanje ni uspelo.');
      }
      router.push('/admin/orders');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Napaka pri brisanju naročila.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="h-full rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
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
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-[12px] shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
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
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-[12px] shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              {PAYMENT_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <FloatingTextarea
          id="paymentNote"
          label="Opombe plačila"
          rows={2}
          value={currentPaymentNote ?? ''}
          onChange={(value) => setCurrentPaymentNote(value)}
        />

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

        {message && <p className="text-sm text-rose-600">{message}</p>}
      </div>

      {isDeleteModalOpen ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/30 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl">
            <p className="text-sm font-semibold text-slate-900">Izbris naročila</p>
            <p className="mt-2 text-xs text-slate-600">Ali ste prepričani, da želite izbrisati to naročilo?</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600"
              >
                Prekliči
              </button>
              <button
                type="button"
                onClick={confirmDeleteOrder}
                className="h-8 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-700"
              >
                Izbriši
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
