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
};

export default function AdminOrderHeaderChips({ orderId, orderNumber, status, paymentStatus }: Props) {
  const router = useRouter();
  const [currentStatus, setCurrentStatus] = useState(status);
  const [currentPaymentStatus, setCurrentPaymentStatus] = useState<string>(
    isPaymentStatus(paymentStatus ?? '') ? paymentStatus ?? 'unpaid' : 'unpaid'
  );
  const [draftStatus, setDraftStatus] = useState(currentStatus);
  const [draftPaymentStatus, setDraftPaymentStatus] = useState(currentPaymentStatus);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const saveStatuses = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const [statusResponse, paymentResponse] = await Promise.all([
        fetch(`/api/admin/orders/${orderId}/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: draftStatus })
        }),
        fetch(`/api/admin/orders/${orderId}/payment-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: draftPaymentStatus })
        })
      ]);

      if (!statusResponse.ok || !paymentResponse.ok) {
        const err = await statusResponse.json().catch(() => ({}));
        throw new Error(err.message || 'Posodobitev statusov ni uspela.');
      }

      setCurrentStatus(draftStatus);
      setCurrentPaymentStatus(draftPaymentStatus);
      setIsEditing(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Napaka pri posodobitvi statusov.');
    } finally {
      setIsSaving(false);
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
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-white to-slate-50 px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{orderNumber}</h1>

        <div className="flex items-center gap-1.5">
          {isEditing ? (
            <>
              <select value={draftStatus} onChange={(e) => setDraftStatus(e.target.value)} className="h-8 rounded-lg border border-slate-300 px-2 text-xs">
                {ORDER_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <select value={draftPaymentStatus} onChange={(e) => setDraftPaymentStatus(e.target.value)} className="h-8 rounded-lg border border-slate-300 px-2 text-xs">
                {PAYMENT_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <button type="button" onClick={saveStatuses} disabled={isSaving} className="h-8 rounded-lg border border-slate-200 px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                {isSaving ? 'Shranjujem ...' : 'Shrani'}
              </button>
            </>
          ) : (
            <>
              <StatusChip status={currentStatus} />
              <PaymentChip status={currentPaymentStatus} />
            </>
          )}

          <button
            type="button"
            onClick={() => {
              if (!isEditing) {
                setDraftStatus(currentStatus);
                setDraftPaymentStatus(currentPaymentStatus);
              }
              setIsEditing((prev) => !prev);
            }}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-xs text-slate-600 hover:bg-slate-100"
            aria-label="Uredi statuse"
          >
            ✎
          </button>

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
      </div>

      {message ? <p className="mt-2 text-xs text-slate-600">{message}</p> : null}

      {isDeleteModalOpen ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/30 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl">
            <p className="text-sm font-semibold text-slate-900">Izbris naročila</p>
            <p className="mt-2 text-xs text-slate-600">Ali ste prepričani, da želite izbrisati to naročilo?</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setIsDeleteModalOpen(false)} className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600">Prekliči</button>
              <button type="button" onClick={confirmDeleteOrder} className="h-8 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-700">Izbriši</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
