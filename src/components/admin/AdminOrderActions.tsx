'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ORDER_STATUS_OPTIONS } from '@/lib/orderStatus';

type Props = {
  orderId: number;
  status: string;
  children?: React.ReactNode;
};

export default function AdminOrderActions({ orderId, status, children }: Props) {
  const router = useRouter();
  const [currentStatus, setCurrentStatus] = useState(status);
  const [message, setMessage] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const updateStatus = async () => {
    setIsWorking(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: currentStatus })
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Posodobitev ni uspela.');
      }
      setMessage('Status je posodobljen.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Napaka pri posodobitvi statusa.');
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
        <div>
          <label className="text-xs font-medium text-slate-700" htmlFor="status">
            Status naročila
          </label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              id="status"
              value={currentStatus}
              onChange={(event) => setCurrentStatus(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[12px]"
            >
              {ORDER_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={updateStatus}
              disabled={isWorking}
              className="whitespace-nowrap rounded-full bg-brand-600 px-4 py-2 text-[12px] font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              Shrani status
            </button>
          </div>
        </div>

        {children ? <div className="border-t border-slate-100 pt-4">{children}</div> : null}

        <button
          type="button"
          onClick={deleteOrder}
          disabled={isDeleting}
          className="w-full rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:border-red-300 hover:text-red-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
        >
          {isDeleting ? 'Brisanje...' : 'Izbriši naročilo'}
        </button>

        {message && <p className="text-sm text-slate-600">{message}</p>}
      </div>
    </div>
  );
}
