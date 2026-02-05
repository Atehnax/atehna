'use client';

import { useState } from 'react';
import { ORDER_STATUS_OPTIONS } from '@/lib/orderStatus';

type Props = {
  orderId: number;
  status: string;
};

export default function AdminOrderActions({ orderId, status }: Props) {
  const [currentStatus, setCurrentStatus] = useState(status);
  const [message, setMessage] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);

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

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Administracija</h2>
      <div className="mt-4 space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-700" htmlFor="status">
            Status naročila
          </label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              id="status"
              value={currentStatus}
              onChange={(event) => setCurrentStatus(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
              className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              Shrani status
            </button>
          </div>
        </div>

        {message && <p className="text-sm text-slate-600">{message}</p>}
      </div>
    </div>
  );
}
