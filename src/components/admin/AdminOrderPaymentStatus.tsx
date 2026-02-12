'use client';

import { useState } from 'react';
import { PAYMENT_STATUS_OPTIONS, getPaymentLabel } from '@/lib/paymentStatus';

type LogEntry = {
  id: number;
  previous_status: string | null;
  new_status: string;
  note: string | null;
  created_at: string;
};

type Props = {
  orderId: number;
  status: string | null;
  notes: string | null;
  logs: LogEntry[];
  embedded?: boolean;
};

const formatTimestamp = (value: string) =>
  new Date(value).toLocaleString('sl-SI', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

export default function AdminOrderPaymentStatus({
  orderId,
  status,
  notes,
  logs,
  embedded = false
}: Props) {
  const [currentStatus, setCurrentStatus] = useState(status ?? 'unpaid');
  const [currentNote, setCurrentNote] = useState(notes ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/payment-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: currentStatus, note: currentNote })
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Shranjevanje ni uspelo.');
      }
      setMessage('Plačilni status je posodobljen.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Napaka pri shranjevanju statusa.');
    } finally {
      setIsSaving(false);
    }
  };

  const content = (
    <>
      <h2 className="text-base font-semibold text-slate-900">Plačilni status</h2>
      <div className="mt-4 grid gap-4">
        <div>
          <label className="text-xs font-medium text-slate-700" htmlFor="paymentStatus">
            Status plačila
          </label>
          <select
            id="paymentStatus"
            value={currentStatus}
            onChange={(event) => setCurrentStatus(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-[12px]"
          >
            {PAYMENT_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-700" htmlFor="paymentNote">
            Opombe
          </label>
          <textarea
            id="paymentNote"
            rows={3}
            value={currentNote}
            onChange={(event) => setCurrentNote(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-[12px]"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="whitespace-nowrap rounded-full bg-brand-600 px-4 py-2 text-[12px] font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            {isSaving ? 'Shranjevanje...' : 'Shrani status'}
          </button>
          {message && <span className="text-sm text-slate-600">{message}</span>}
        </div>
        {logs.length > 0 && (
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
            <p className="text-xs font-semibold uppercase text-slate-400">
              Zgodovina sprememb
            </p>
            <ul className="mt-2 space-y-2">
              {logs.map((log) => (
                <li key={log.id}>
                  <span className="font-semibold text-slate-900">
                    {getPaymentLabel(log.new_status)}
                  </span>{' '}
                  <span className="text-xs text-slate-400">{formatTimestamp(log.created_at)}</span>
                  {log.note && <div className="text-xs text-slate-500">Opomba: {log.note}</div>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );

  if (embedded) return content;

  return <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">{content}</section>;
}
