'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PaymentChip from '@/components/admin/PaymentChip';
import StatusChip from '@/components/admin/StatusChip';
import { ORDER_STATUS_OPTIONS } from '@/lib/orderStatus';
import { PAYMENT_STATUS_OPTIONS, isPaymentStatus } from '@/lib/paymentStatus';

type Props = {
  orderId: number;
  orderNumber: string;
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

export default function AdminOrderActions({ orderId, orderNumber, status, paymentStatus, paymentNotes }: Props) {
  const router = useRouter();
  const [currentStatus, setCurrentStatus] = useState(status);
  const [currentPaymentStatus, setCurrentPaymentStatus] = useState<string>(
    isPaymentStatus(paymentStatus ?? '') ? paymentStatus ?? 'unpaid' : 'unpaid'
  );
  const [currentPaymentNote, setCurrentPaymentNote] = useState<string>(paymentNotes ?? '');
  const [draftStatus, setDraftStatus] = useState(status);
  const [draftPaymentStatus, setDraftPaymentStatus] = useState<string>(
    isPaymentStatus(paymentStatus ?? '') ? paymentStatus ?? 'unpaid' : 'unpaid'
  );
  const [isStatusEditorOpen, setIsStatusEditorOpen] = useState(false);
  const [isPaymentEditorOpen, setIsPaymentEditorOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [isSavingPaymentStatus, setIsSavingPaymentStatus] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const saveStatus = async () => {
    setIsSavingStatus(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: draftStatus })
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Posodobitev statusa naročila ni uspela.');
      }
      setCurrentStatus(draftStatus);
      setIsStatusEditorOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Napaka pri posodobitvi statusa naročila.');
    } finally {
      setIsSavingStatus(false);
    }
  };

  const savePaymentStatus = async () => {
    setIsSavingPaymentStatus(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/payment-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: draftPaymentStatus, note: currentPaymentNote })
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Posodobitev plačilnega statusa ni uspela.');
      }
      setCurrentPaymentStatus(draftPaymentStatus);
      setIsPaymentEditorOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Napaka pri posodobitvi plačilnega statusa.');
    } finally {
      setIsSavingPaymentStatus(false);
    }
  };

  const saveNotes = async () => {
    setIsSavingNotes(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/payment-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: currentPaymentStatus, note: currentPaymentNote })
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

  const confirmDeleteOrder = async () => {
    setIsDeleting(true);
    setIsDeleteModalOpen(false);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, { method: 'DELETE' });
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
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{orderNumber}</h1>

          <div className="relative flex items-center gap-1">
            <StatusChip status={currentStatus} />
            <button
              type="button"
              onClick={() => {
                setDraftStatus(currentStatus);
                setIsStatusEditorOpen((prev) => !prev);
                setIsPaymentEditorOpen(false);
              }}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 text-xs text-slate-600 hover:bg-slate-100"
              aria-label="Uredi status naročila"
            >
              ✎
            </button>
            {isStatusEditorOpen ? (
              <div className="absolute left-0 top-8 z-20 w-44 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                <select
                  value={draftStatus}
                  onChange={(event) => setDraftStatus(event.target.value)}
                  className="h-8 w-full rounded-md border border-slate-300 px-2 text-xs"
                >
                  {ORDER_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={saveStatus}
                  disabled={isSavingStatus}
                  className="mt-2 h-7 w-full rounded-md border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {isSavingStatus ? 'Shranjujem ...' : 'Shrani'}
                </button>
              </div>
            ) : null}
          </div>

          <div className="relative flex items-center gap-1">
            <PaymentChip status={currentPaymentStatus} />
            <button
              type="button"
              onClick={() => {
                setDraftPaymentStatus(currentPaymentStatus);
                setIsPaymentEditorOpen((prev) => !prev);
                setIsStatusEditorOpen(false);
              }}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 text-xs text-slate-600 hover:bg-slate-100"
              aria-label="Uredi status plačila"
            >
              ✎
            </button>
            {isPaymentEditorOpen ? (
              <div className="absolute left-0 top-8 z-20 w-44 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                <select
                  value={draftPaymentStatus}
                  onChange={(event) => setDraftPaymentStatus(event.target.value)}
                  className="h-8 w-full rounded-md border border-slate-300 px-2 text-xs"
                >
                  {PAYMENT_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={savePaymentStatus}
                  disabled={isSavingPaymentStatus}
                  className="mt-2 h-7 w-full rounded-md border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {isSavingPaymentStatus ? 'Shranjujem ...' : 'Shrani'}
                </button>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => setIsDeleteModalOpen(true)}
            disabled={isDeleting}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 text-sm font-semibold leading-none text-rose-600 hover:bg-rose-50 disabled:text-slate-300"
            aria-label="Izbriši naročilo"
            title="Izbriši"
          >
            ×
          </button>
        </div>

        <div className="w-full max-w-sm space-y-2">
          <FloatingTextarea
            id="paymentNote"
            label="Opombe"
            rows={2}
            value={currentPaymentNote}
            onChange={setCurrentPaymentNote}
          />
          <button
            type="button"
            onClick={saveNotes}
            disabled={isSavingNotes}
            className="h-8 rounded-full bg-brand-600 px-4 text-xs font-semibold text-white hover:bg-brand-700 disabled:bg-slate-200 disabled:text-slate-400"
          >
            {isSavingNotes ? 'Shranjujem ...' : 'Shrani'}
          </button>
        </div>
      </div>

      {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}

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
    </section>
  );
}
