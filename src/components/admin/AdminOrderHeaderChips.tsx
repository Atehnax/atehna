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
  customerType: string;
  organizationName: string | null;
  contactName: string;
  email: string;
  deliveryAddress: string | null;
  notes: string | null;
  createdAt: string;
};


const customerTypeOptions = [
  { value: 'individual', label: 'Fizična oseba' },
  { value: 'company', label: 'Podjetje' },
  { value: 'school', label: 'Šola / javni zavod' }
];

const toDateInputValue = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
};

function SaveIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 3h9l3 3v11H4z" />
      <path d="M7 3v5h6V3" />
      <path d="M7 13h6" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 14.5l.5-3L13.5 2.5l3 3L7.5 14.5z" />
      <path d="M11.5 4.5l3 3" />
    </svg>
  );
}

export default function AdminOrderHeaderChips({
  orderId,
  orderNumber,
  status,
  paymentStatus,
  customerType,
  organizationName,
  contactName,
  email,
  deliveryAddress,
  notes,
  createdAt
}: Props) {
  const router = useRouter();
  const [currentStatus, setCurrentStatus] = useState(status);
  const [currentPaymentStatus, setCurrentPaymentStatus] = useState<string>(
    isPaymentStatus(paymentStatus ?? '') ? paymentStatus ?? 'unpaid' : 'unpaid'
  );
  const [draftStatus, setDraftStatus] = useState(currentStatus);
  const [draftPaymentStatus, setDraftPaymentStatus] = useState(currentPaymentStatus);
  const [isStatusEditing, setIsStatusEditing] = useState(false);

  const [details, setDetails] = useState({
    customerType,
    organizationName: organizationName ?? '',
    contactName,
    email,
    deliveryAddress: deliveryAddress ?? '',
    notes: notes?.trim() ? notes : '/',
    orderDate: toDateInputValue(createdAt)
  });
  const [draftDetails, setDraftDetails] = useState(details);
  const [isDetailsEditing, setIsDetailsEditing] = useState(false);

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
      setIsStatusEditing(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Napaka pri posodobitvi statusov.');
    } finally {
      setIsSaving(false);
    }
  };

  const saveDetails = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerType: draftDetails.customerType,
          organizationName: draftDetails.organizationName,
          contactName: draftDetails.contactName,
          email: draftDetails.email,
          deliveryAddress: draftDetails.deliveryAddress,
          notes: draftDetails.notes,
          orderDate: draftDetails.orderDate
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Shranjevanje ni uspelo.');
      }

      setDetails(draftDetails);
      setIsDetailsEditing(false);
      window.dispatchEvent(
        new CustomEvent('admin-order-details-updated', {
          detail: {
            organizationName: draftDetails.organizationName,
            contactName: draftDetails.contactName,
            customerType: draftDetails.customerType,
            email: draftDetails.email,
            deliveryAddress: draftDetails.deliveryAddress,
            notes: draftDetails.notes
          }
        })
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Napaka pri shranjevanju.');
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

  const activeDetails = isDetailsEditing ? draftDetails : details;

  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-white to-slate-50 px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{orderNumber}</h1>

        <div className="ml-auto flex items-center gap-1.5">
          {isStatusEditing ? (
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
              if (isStatusEditing) {
                void saveStatuses();
                return;
              }
              setDraftStatus(currentStatus);
              setDraftPaymentStatus(currentPaymentStatus);
              setIsStatusEditing(true);
            }}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-xs text-slate-600 hover:bg-slate-100"
            aria-label="Uredi statuse"
            disabled={isSaving}
          >
            {isStatusEditing ? <SaveIcon /> : <PencilIcon />}
          </button>

          <button
            type="button"
            onClick={() => {
              if (isDetailsEditing) {
                void saveDetails();
                return;
              }
              setDraftDetails(details);
              setIsDetailsEditing(true);
            }}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-xs text-slate-600 hover:bg-slate-100"
            aria-label="Uredi podatke"
            disabled={isSaving}
          >
            {isDetailsEditing ? <SaveIcon /> : <PencilIcon />}
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

      <div className="mt-4 grid gap-3 md:grid-cols-2 text-[12px]">
        <div className="relative">
          <label className="pointer-events-none absolute left-2.5 top-1.5 bg-white px-1 text-[10px] text-slate-600">Datum</label>
          <input
            type="date"
            value={activeDetails.orderDate}
            disabled={!isDetailsEditing}
            onChange={(event) => setDraftDetails((prev) => ({ ...prev, orderDate: event.target.value }))}
            className="h-10 w-full rounded-xl border border-slate-300 bg-white px-2.5 pt-4 text-xs disabled:bg-slate-100 disabled:text-slate-500"
          />
        </div>

        <div className="relative">
          <select
            value={activeDetails.customerType}
            disabled={!isDetailsEditing}
            onChange={(event) => setDraftDetails((prev) => ({ ...prev, customerType: event.target.value }))}
            className="h-10 w-full appearance-none rounded-xl border border-slate-300 bg-white px-2.5 pt-4 text-xs disabled:bg-slate-100 disabled:text-slate-500"
          >
            {customerTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <label className="pointer-events-none absolute left-2.5 top-1.5 bg-white px-1 text-[10px] text-slate-600">Tip naročnika</label>
        </div>

        <div className="md:col-span-2 relative">
          <label className="pointer-events-none absolute left-2.5 top-1.5 bg-white px-1 text-[10px] text-slate-600">Naročnik</label>
          <input
            value={activeDetails.organizationName}
            disabled={!isDetailsEditing}
            onChange={(event) => setDraftDetails((prev) => ({ ...prev, organizationName: event.target.value }))}
            className="h-10 w-full rounded-xl border border-slate-300 bg-white px-2.5 pt-4 text-xs disabled:bg-slate-100 disabled:text-slate-500"
          />
        </div>

        <div className="relative">
          <label className="pointer-events-none absolute left-2.5 top-1.5 bg-white px-1 text-[10px] text-slate-600">Kontakt</label>
          <input
            value={activeDetails.contactName}
            disabled={!isDetailsEditing}
            onChange={(event) => setDraftDetails((prev) => ({ ...prev, contactName: event.target.value }))}
            className="h-10 w-full rounded-xl border border-slate-300 bg-white px-2.5 pt-4 text-xs disabled:bg-slate-100 disabled:text-slate-500"
          />
        </div>

        <div className="relative">
          <label className="pointer-events-none absolute left-2.5 top-1.5 bg-white px-1 text-[10px] text-slate-600">Email</label>
          <input
            type="email"
            value={activeDetails.email}
            disabled={!isDetailsEditing}
            onChange={(event) => setDraftDetails((prev) => ({ ...prev, email: event.target.value }))}
            className="h-10 w-full rounded-xl border border-slate-300 bg-white px-2.5 pt-4 text-xs disabled:bg-slate-100 disabled:text-slate-500"
          />
        </div>

        <div className="md:col-span-2 relative">
          <label className="pointer-events-none absolute left-2.5 top-1.5 bg-white px-1 text-[10px] text-slate-600">Naslov</label>
          <input
            value={activeDetails.deliveryAddress}
            disabled={!isDetailsEditing}
            onChange={(event) => setDraftDetails((prev) => ({ ...prev, deliveryAddress: event.target.value }))}
            className="h-10 w-full rounded-xl border border-slate-300 bg-white px-2.5 pt-4 text-xs disabled:bg-slate-100 disabled:text-slate-500"
          />
        </div>

        <div className="md:col-span-2 relative">
          <label className="pointer-events-none absolute left-2.5 top-1.5 bg-white px-1 text-[10px] text-slate-600">Opombe</label>
          <textarea
            rows={3}
            value={activeDetails.notes}
            disabled={!isDetailsEditing}
            onChange={(event) => setDraftDetails((prev) => ({ ...prev, notes: event.target.value }))}
            className="w-full rounded-xl border border-slate-300 bg-white px-2.5 pb-2 pt-5 text-xs disabled:bg-slate-100 disabled:text-slate-500"
          />
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
