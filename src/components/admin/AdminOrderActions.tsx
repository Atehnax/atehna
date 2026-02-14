'use client';

import { useState } from 'react';

type Props = {
  paymentStatus?: string | null;
  paymentNotes?: string | null;
  orderId: number;
};

const isFilled = (value: unknown) => typeof value === 'string' && value.trim().length > 0;

type FloatingTextareaProps = {
  id: string;
  label: string;
  value: string;
  rows?: number;
  onChange: (value: string) => void;
};

function FloatingTextarea({ id, label, value, rows = 3, onChange }: FloatingTextareaProps) {
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

export default function AdminOrderActions({ paymentStatus, paymentNotes, orderId }: Props) {
  const [currentPaymentNote, setCurrentPaymentNote] = useState<string>(paymentNotes ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  const saveNotes = async () => {
    setIsSavingNotes(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/payment-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: paymentStatus ?? 'unpaid', note: currentPaymentNote })
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Shranjevanje opomb ni uspelo.');
      }
      setMessage('Opombe so shranjene.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Napaka pri shranjevanju opomb.');
    } finally {
      setIsSavingNotes(false);
    }
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Opombe</h2>
      <div className="mt-4 space-y-3">
        <FloatingTextarea id="paymentNote" label="Opombe" rows={4} value={currentPaymentNote} onChange={setCurrentPaymentNote} />
        <button
          type="button"
          onClick={saveNotes}
          disabled={isSavingNotes}
          className="h-8 rounded-full bg-brand-600 px-4 text-xs font-semibold text-white hover:bg-brand-700 disabled:bg-slate-200 disabled:text-slate-400"
        >
          {isSavingNotes ? 'Shranjujem ...' : 'Shrani'}
        </button>
      </div>
      {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}
    </section>
  );
}
